#!/usr/bin/env node
// order-sync.js — Node.js port of backlog-order-sync.ps1
// Reads config from config/*.json (repo)
// Env: FLOAT_API_KEY, MONDAY_TOKEN, TARGET_DATE, DRY_RUN, FLOAT_EMAIL, FLOAT_PASSWORD

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ─── Inputs ─────────────────────────────────────────────────────────────────
function smartTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  if (d.getDay() === 6) d.setDate(d.getDate() + 2)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const DATE           = process.env.TARGET_DATE    || smartTomorrow()
const DRY_RUN        = process.env.DRY_RUN        === 'true'
const FLOAT_API_KEY  = process.env.FLOAT_API_KEY  || ''
const MONDAY_TOKEN   = process.env.MONDAY_TOKEN   || ''
const FLOAT_SESSION_COOKIE = process.env.FLOAT_SESSION_COOKIE || ''

if (!FLOAT_API_KEY) { console.error('❌ FLOAT_API_KEY not set'); process.exit(1) }
if (!MONDAY_TOKEN) { console.error('❌ MONDAY_TOKEN not set'); process.exit(1) }

console.log(`Order Sync — date: ${DATE} | dryRun: ${DRY_RUN}`)
if (DRY_RUN) console.log('[DRY RUN — нічого не змінюється в Monday]')

// ─── Config ──────────────────────────────────────────────────────────────────
function loadJson(file) {
  try { return JSON.parse(readFileSync(join(ROOT, 'config', file), 'utf8')) }
  catch { console.warn(`⚠️ Could not read config/${file}`); return [] }
}

const nameExceptionsRows  = loadJson('name_exceptions.json')
const skipExactRows       = loadJson('skip_tasks_exact.json')
const skipContainRows     = loadJson('skip_tasks_contain.json')

// name_exceptions: float_name → monday_search
const nameExceptions = {}
for (const row of nameExceptionsRows) {
  const fn = (row.float_name || '').trim()
  const ms = (row.monday_search || '').trim()
  if (fn && ms) nameExceptions[fn] = ms
}

// skip exact: set of lowercase task names
const skipExact = new Set(skipExactRows.map(r => (r.task_name || '').trim().toLowerCase()).filter(Boolean))

// skip contain: array of substrings
const skipContain = skipContainRows.map(r => (r.substring || '').trim()).filter(Boolean)

console.log(`Config: ${Object.keys(nameExceptions).length} name exceptions | ${skipExact.size} skip exact | ${skipContain.length} skip contain`)

// ─── Float API ───────────────────────────────────────────────────────────────
const FLOAT_HEADERS = {
  'Authorization': `Bearer ${FLOAT_API_KEY}`,
}

async function floatGetAll(path) {
  const results = []
  let page = 1
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const url = `https://api.float.com/v3${path}${sep}per-page=200&page=${page}`
    const res = await fetch(url, { headers: FLOAT_HEADERS })
    if (!res.ok) throw new Error(`Float API ${path} → ${res.status} ${res.statusText}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    results.push(...data)
    if (data.length < 200) break
    page++
  }
  return results
}

// ─── Float session login (svc/api3 → priority field) ────────────────────────
function parseCookieHeaders(raw) {
  const cookies = {}
  if (!raw) return cookies
  for (const part of raw.split(/,(?=[^;]+=)/)) {
    const nameVal = part.split(';')[0].trim()
    const eq = nameVal.indexOf('=')
    if (eq > 0) cookies[nameVal.slice(0, eq).trim()] = nameVal.slice(eq + 1).trim()
  }
  return cookies
}
function cookieStr(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function getFloatSessionJWT() {
  if (!FLOAT_SESSION_COOKIE) return null

  // Use Playwright headless Chrome: load Float with session cookie,
  // intercept network requests to capture the Bearer JWT
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const context = await browser.newContext()

  await context.addCookies([{
    name: 'float2sessprd', value: FLOAT_SESSION_COOKIE,
    domain: 'rsg.float.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax',
  }])

  let capturedJwt = null
  const page = await context.newPage()

  page.on('request', req => {
    if (capturedJwt) return
    const auth = req.headers()['authorization']
    if (auth && auth.startsWith('Bearer eyJ')) capturedJwt = auth.slice(7)
  })

  try {
    await page.goto('https://rsg.float.com/', { waitUntil: 'networkidle', timeout: 25000 })
  } catch (_) { /* networkidle may timeout on polling apps — ok if JWT captured */ }

  await browser.close()

  if (!capturedJwt) throw new Error('JWT not captured — session cookie may have expired (update FLOAT_SESSION_COOKIE in Settings)')
  console.log('✅ Float JWT captured via Playwright')
  return capturedJwt
}

// Fetch from old svc/api3 (returns priority field for visual sort order)
async function floatGetAllOld(path, jwt) {
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
  const notifyUuid = `${payload.company?.id}-${payload.account?.id}-${randomUUID()}`
  const results = []
  let page = 1
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const url = `https://rsg.float.com/svc/api3/v3${path}${sep}per-page=200&page=${page}`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'x-token-type': 'JWT', 'notify-uuid': notifyUuid },
    })
    if (!res.ok) throw new Error(`Float svc/api3 ${path} → ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    results.push(...data)
    if (data.length < 200) break
    page++
  }
  return results
}

// ─── Monday API ───────────────────────────────────────────────────────────────
const MONDAY_HEADERS = { 'Authorization': MONDAY_TOKEN, 'Content-Type': 'application/json' }

async function mondayPost(query) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: MONDAY_HEADERS,
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Monday API → ${res.status} ${res.statusText}`)
  const json = await res.json()
  // Monday always returns HTTP 200 — errors come inside the response body
  if (json.errors?.length) {
    throw new Error(`Monday GraphQL error: ${json.errors.map(e => e.message).join('; ')}`)
  }
  return json
}

// Paginated fetch of all board items
async function getMondayItems(boardId, colIds) {
  const colList = colIds.map(c => `"${c}"`).join(', ')
  const items = []
  let cursor = null
  do {
    const cursorPart = cursor ? `, cursor: "${cursor}"` : ''
    const query = `{ boards(ids: [${boardId}]) { items_page(limit: 500${cursorPart}) { cursor items { id name column_values(ids: [${colList}]) { id text } } } } }`
    const json = await mondayPost(query)
    const page = json?.data?.boards?.[0]?.items_page
    if (!page) break
    items.push(...(page.items || []))
    cursor = page.cursor || null
  } while (cursor)
  console.log(`  Board ${boardId}: ${items.length} items loaded`)
  return items
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DEPT_2D = new Set([16847732, 16942651, 16847734, 16942883])
const DEPT_3D = new Set([16847733, 16942652, 16871680, 16942885])

const BOARD_IDS = { '2D': 9037985819, '3D': 9108154275 }

const BOARD_COLS = {
  '3D': { order: 'numeric_mkqsdrtr', artistCols: ['text_mkqsdqpv', 'person'],        floatProjectCol: 'text_mkqshmpp' },
  '2D': { order: 'numeric_mkqg5km8', artistCols: ['multiple_person_mkqqqx7g'],        floatProjectCol: 'text_mkqqr4r1' },
}

// ─── Skip task check ──────────────────────────────────────────────────────────
function shouldSkip(taskName) {
  const norm  = taskName.replace(/^[^\x00-\x7F]+\s*/, '').toLowerCase().trim()
  const lower = taskName.toLowerCase().trim()
  if (skipExact.has(norm) || skipExact.has(lower)) return true
  if (skipContain.some(sub => new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(taskName))) return true
  return false
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Try to get Float session JWT for priority-aware sorting (svc/api3)
  let sessionJwt = null
  if (FLOAT_SESSION_COOKIE) {
    try {
      sessionJwt = await getFloatSessionJWT()
    } catch (e) {
      console.warn(`⚠️ Float session JWT failed: ${e.message} — falling back to official API (approximate sort order)`)
      // GitHub Actions annotation — picked up by BK9K UI to show warning banner
      console.log('::warning::FLOAT_SESSION_COOKIE_EXPIRED')
    }
  } else {
    console.log('ℹ️ FLOAT_SESSION_COOKIE not set — using official API (approximate sort order)')
    console.log('::warning::FLOAT_SESSION_COOKIE_EXPIRED')
  }

  console.log('Fetching Float data...')
  const [allPeople, allTasks, floatProjects] = await Promise.all([
    floatGetAll('/people'),
    sessionJwt
      ? floatGetAllOld(`/tasks/all?start_date=${DATE}&end_date=${DATE}`, sessionJwt)
      : floatGetAll(`/tasks?start_date=${DATE}&end_date=${DATE}`),
    floatGetAll('/projects'),
  ])
  console.log(`Tasks fetched via: ${sessionJwt ? 'svc/api3 (priority sort)' : 'official API (approximate sort)'}`)

  const floatProjectNames = {}
  for (const p of floatProjects) floatProjectNames[p.project_id] = p.name

  // Filter artists: 2D/3D, active=1
  // NOTE: Fix Price tag NOT filtered (unlike float-check) — they're in Monday backlog
  // NOTE: ⌛ prefix NOT filtered — they're in Monday backlog too
  const allDeptIds = new Set([...DEPT_2D, ...DEPT_3D])
  const artists = allPeople.filter(p => allDeptIds.has(p.department?.department_id) && p.active === 1)
  console.log(`Artists: ${artists.length}`)

  // Fetch Monday boards
  console.log('Fetching Monday backlog boards...')
  const cols2D = [...BOARD_COLS['2D'].artistCols, BOARD_COLS['2D'].order, BOARD_COLS['2D'].floatProjectCol]
  const cols3D = [...BOARD_COLS['3D'].artistCols, BOARD_COLS['3D'].order, BOARD_COLS['3D'].floatProjectCol]
  const [mondayItems2D, mondayItems3D] = await Promise.all([
    getMondayItems(BOARD_IDS['2D'], cols2D),
    getMondayItems(BOARD_IDS['3D'], cols3D),
  ])

  let totalUpdated   = 0
  let totalUnmatched = 0
  const dupReport    = []  // Monday-side duplicate task names: {board, artist, task, count}

  for (const a of artists) {
    const personId  = a.people_id
    const cleanName = (a.name || '').replace(/^[⏳⌛🔄⚡]\s*/, '').trim()
    const is3D      = DEPT_3D.has(a.department?.department_id)
    const boardName = is3D ? '3D' : '2D'
    const boardId   = BOARD_IDS[boardName]
    const mondayPool   = is3D ? mondayItems3D : mondayItems2D
    const cols         = BOARD_COLS[boardName]
    const orderColId   = cols.order
    const artistColIds = cols.artistCols
    const fpColId      = cols.floatProjectCol

    // Float tasks for this person today
    // Multi-person tasks come back with people_id: null + people_ids: [id1, id2]
    // If svc/api3: sort by priority ascending (more negative = higher in Float calendar)
    // If official API: use response order (best available approximation)
    const floatTasks = allTasks
      .filter(t => (t.people_id ? [t.people_id] : (t.people_ids || [])).includes(personId))
      .sort((a, b) => {
        if (a.priority != null && b.priority != null) return a.priority - b.priority
        return 0 // preserve API response order
      })

    if (floatTasks.length === 0) continue

    // Determine search name (last name, or exception override)
    const lastName = nameExceptions[cleanName] || cleanName.split(' ').pop()

    // Monday items for this person (match any artist column by last name)
    const myMonday = mondayPool.filter(item =>
      artistColIds.some(colId => {
        const col = item.column_values?.find(c => c.id === colId)
        return col?.text?.includes(lastName)
      })
    )
    if (myMonday.length === 0) continue

    // Build lookup maps
    const mondayByName = {}   // lowercase name → [item ids] (duplicates supported)
    const mondayByFP   = {}   // float project name lower → [item ids]

    for (const item of myMonday) {
      const nameKey = item.name.toLowerCase().trim()
      if (!mondayByName[nameKey]) mondayByName[nameKey] = []
      mondayByName[nameKey].push(item.id)
      const fpText = item.column_values?.find(c => c.id === fpColId)?.text
      if (fpText) {
        const fpKey = fpText.toLowerCase().trim()
        if (!mondayByFP[fpKey]) mondayByFP[fpKey] = []
        mondayByFP[fpKey].push(item.id)
      }
    }

    // Collect Monday-side duplicates for the end-of-run report
    for (const [nameKey, ids] of Object.entries(mondayByName)) {
      if (ids.length > 1) {
        const original = myMonday.find(i => i.name.toLowerCase().trim() === nameKey)?.name || nameKey
        dupReport.push({ board: boardName, artist: cleanName, task: original, count: ids.length })
      }
    }

    console.log(`\n--- ${cleanName} [${boardName}] ---`)
    const assignedItems = new Set()
    let orderNum = 1

    for (const ft of floatTasks) {
      const taskName = ft.name || ''

      if (shouldSkip(taskName)) {
        console.log(`  [skip] ${taskName}`)
        continue
      }

      const nameLower = taskName.toLowerCase().trim()
      const nameNorm  = nameLower.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

      // Tier 1: exact name — take the next unassigned Monday duplicate
      let itemId   = (mondayByName[nameLower] || []).find(id => !assignedItems.has(id)) || null
      let matchHow = itemId ? 'exact' : null

      // Tier 2: fuzzy name
      if (!itemId) {
        for (const [mKey, mIds] of Object.entries(mondayByName)) {
          const mNorm = mKey.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
          if (nameNorm.includes(mNorm) || mNorm.includes(nameNorm)) {
            const free = mIds.find(id => !assignedItems.has(id))
            if (free) {
              itemId   = free
              matchHow = 'fuzzy-name'
              break
            }
          }
        }
      }

      // Tier 3: Float project name → Monday Float Project Name column
      if (!itemId && ft.project_id) {
        const fpName = floatProjectNames[ft.project_id]
        if (fpName) {
          const fpKey = fpName.toLowerCase().trim()
          const candidates = (mondayByFP[fpKey] || []).filter(id => !assignedItems.has(id))
          if (candidates.length === 1) {
            itemId   = candidates[0]
            matchHow = 'proj'
          } else if (candidates.length > 1) {
            matchHow = 'proj-ambiguous'
          }
        }
      }

      if (matchHow === 'proj-ambiguous') {
        const projName = floatProjectNames[ft.project_id] || ''
        console.log(`  [${orderNum}] ${taskName} → AMBIGUOUS (project: ${projName})`)
        totalUnmatched++
        orderNum++
        continue
      }

      if (itemId) {
        const tag = matchHow !== 'exact' ? `~${orderNum} (${matchHow})` : `${orderNum}`
        console.log(`  [${tag}] ${taskName} → item ${itemId}`)
        if (!DRY_RUN) {
          const mutation = `mutation { change_simple_column_value(board_id: ${boardId}, item_id: ${itemId}, column_id: "${orderColId}", value: "${orderNum}") { id } }`
          try {
            await mondayPost(mutation)
          } catch (err) {
            console.error(`  ❌ Monday write failed for item ${itemId}: ${err.message}`)
          }
        }
        assignedItems.add(itemId)
        totalUpdated++
      } else {
        const projLabel = ft.project_id && floatProjectNames[ft.project_id]
          ? ` [project: ${floatProjectNames[ft.project_id]}]` : ''
        console.log(`  [${orderNum}] ${taskName}${projLabel} → NO MATCH`)
        totalUnmatched++
      }
      orderNum++
    }
  }

  console.log('\n=== Done ===')
  if (DRY_RUN) process.stdout.write('[DRY RUN] ')
  console.log(`Updated: ${totalUpdated} | Unmatched: ${totalUnmatched}`)

  // Monday-side duplicates — console only (Discord dup report lives in float-check)
  if (dupReport.length > 0) {
    console.log(`\n⚠️ Monday duplicates found: ${dupReport.length}`)
    for (const d of dupReport) {
      console.log(`  [${d.board}] ${d.artist}: "${d.task}" ×${d.count}`)
    }
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
