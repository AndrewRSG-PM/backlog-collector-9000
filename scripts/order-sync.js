#!/usr/bin/env node
// order-sync.js — Node.js port of backlog-order-sync.ps1
// Reads config from config/*.json (repo)
// Env: FLOAT_JWT, MONDAY_TOKEN, TARGET_DATE, DRY_RUN

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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

const DATE         = process.env.TARGET_DATE || smartTomorrow()
const DRY_RUN      = process.env.DRY_RUN === 'true'
const FLOAT_JWT    = process.env.FLOAT_JWT || ''
const MONDAY_TOKEN = process.env.MONDAY_TOKEN || ''

if (!FLOAT_JWT)    { console.error('❌ FLOAT_JWT not set');    process.exit(1) }
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
  'authorization': `Bearer ${FLOAT_JWT}`,
  'x-token-type':  'JWT',
  'Referer':        'https://rsg.float.com/public/1.0.705/assets/api.worker-BeZTJ4ff.js',
  'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
}

async function floatGet(path) {
  const res = await fetch(`https://rsg.float.com/svc/api3/v3${path}`, { headers: FLOAT_HEADERS })
  if (!res.ok) throw new Error(`Float API ${path} → ${res.status} ${res.statusText}`)
  return res.json()
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
  console.log('Fetching Float data...')
  const [allPeople, allTasks, floatProjects] = await Promise.all([
    floatGet('/people/all?lean=1'),
    floatGet(`/tasks/all?lean=1&start_date=${DATE}&end_date=${DATE}`),
    floatGet('/projects/all?lean=1'),
  ])

  const floatProjectNames = {}
  for (const p of floatProjects) floatProjectNames[p.project_id] = p.name

  // Filter artists: 2D/3D, active=1
  // NOTE: Fix Price tag NOT filtered (unlike float-check) — they're in Monday backlog
  // NOTE: ⌛ prefix NOT filtered — they're in Monday backlog too
  const allDeptIds = new Set([...DEPT_2D, ...DEPT_3D])
  const artists = allPeople.filter(p => allDeptIds.has(p.department_id) && p.active === 1)
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

  for (const a of artists) {
    const personId  = a.people_id
    const cleanName = (a.name || '').replace(/^[⏳⌛🔄⚡]\s*/, '').trim()
    const is3D      = DEPT_3D.has(a.department_id)
    const boardName = is3D ? '3D' : '2D'
    const boardId   = BOARD_IDS[boardName]
    const mondayPool   = is3D ? mondayItems3D : mondayItems2D
    const cols         = BOARD_COLS[boardName]
    const orderColId   = cols.order
    const artistColIds = cols.artistCols
    const fpColId      = cols.floatProjectCol

    // Float tasks for this person today, sorted by priority (lower = higher)
    const floatTasks = allTasks
      .filter(t => t.people_id === personId)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))

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
    const mondayByName = {}   // lowercase name → item id
    const mondayByFP   = {}   // float project name lower → [item ids]

    for (const item of myMonday) {
      mondayByName[item.name.toLowerCase().trim()] = item.id
      const fpText = item.column_values?.find(c => c.id === fpColId)?.text
      if (fpText) {
        const fpKey = fpText.toLowerCase().trim()
        if (!mondayByFP[fpKey]) mondayByFP[fpKey] = []
        mondayByFP[fpKey].push(item.id)
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

      // Tier 1: exact name
      let itemId   = mondayByName[nameLower] || null
      let matchHow = itemId ? 'exact' : null

      // Tier 2: fuzzy name
      if (!itemId) {
        for (const [mKey, mId] of Object.entries(mondayByName)) {
          const mNorm = mKey.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
          if (nameNorm.includes(mNorm) || mNorm.includes(nameNorm)) {
            itemId   = mId
            matchHow = 'fuzzy-name'
            break
          }
        }
      }

      // Tier 3: Float project name → Monday Float Project Name column
      if (!itemId && ft.project_id) {
        const fpName = floatProjectNames[ft.project_id]
        if (fpName) {
          const fpKey = fpName.toLowerCase().trim()
          const candidates = mondayByFP[fpKey] || []
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
        if (assignedItems.has(itemId)) {
          console.log(`  [skip-dup] ${taskName} → item ${itemId} already assigned`)
        } else {
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
        }
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
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
