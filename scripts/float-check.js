#!/usr/bin/env node
// float-check.js — Node.js port of float-check.ps1
// Reads config from config/*.json (repo), env: FLOAT_JWT, MONDAY_TOKEN,
// DISCORD_WEBHOOK_PROD, DISCORD_WEBHOOK_TEST
// Inputs (via env from workflow): TARGET_DATE, NO_MENTIONS, TEST_MODE

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

const DATE          = process.env.TARGET_DATE  || smartTomorrow()
const NO_MENTIONS   = process.env.NO_MENTIONS  === 'true'
const TEST_MODE     = process.env.TEST_MODE    === 'true'
const FLOAT_API_KEY = process.env.FLOAT_API_KEY || ''
const MONDAY_TOKEN  = process.env.MONDAY_TOKEN  || ''
const WEBHOOK_URL   = TEST_MODE
  ? (process.env.DISCORD_WEBHOOK_TEST  || '')
  : (process.env.DISCORD_WEBHOOK_PROD || '')

if (!FLOAT_API_KEY) { console.error('❌ FLOAT_API_KEY not set'); process.exit(1) }

console.log(`Float Check — date: ${DATE} | noMentions: ${NO_MENTIONS} | testMode: ${TEST_MODE}`)

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

// ─── Department config ───────────────────────────────────────────────────────
const DEPT_2D = new Set([16847732, 16942651, 16847734, 16942883])
const DEPT_3D = new Set([16847733, 16942652, 16871680, 16942885])
const DEPT_NAMES = {
  16847732: '2D',  16942651: '2D Anim',  16847734: '2D Remote',  16942883: '2D TechArt',
  16847733: '3D',  16942652: '3D Anim',  16871680: '3D Remote',  16942885: '3D TechArt',
}

// ─── Load config/*.json ──────────────────────────────────────────────────────
function loadJson(file) {
  try { return JSON.parse(readFileSync(join(ROOT, 'config', file), 'utf8')) }
  catch { console.warn(`⚠️ Could not read config/${file}`); return [] }
}

const floatCheckExceptions = loadJson('float_check_exceptions.json')
const projectExceptions    = loadJson('project_exceptions.json')
const pmDiscordRows        = loadJson('pm_discord.json')

// Build lookups from config rows
const maxHoursConfig   = {}  // cleanName → maxHours
const skipTagsConfig   = []  // tag names to skip entirely
const offTimeoffConfig = []  // timeoff type names to count as off

for (const row of floatCheckExceptions) {
  const name  = (row.name  || '').trim()
  const type  = (row.type  || '').trim()
  const value = (row.value || '').trim()
  const appli = (row.applies_to || '').trim()
  if (!name) continue
  if (type === 'max_hours') {
    maxHoursConfig[name] = parseInt(value, 10) || 8
  } else if (type === 'tag_filter' && value === 'skip_entirely') {
    skipTagsConfig.push(name)
  } else if (type === 'timeoff_type' && value === 'count_as_off') {
    offTimeoffConfig.push(name)
  }
}

// Fallback defaults if config empty
if (skipTagsConfig.length === 0) skipTagsConfig.push('Fix Price')
if (offTimeoffConfig.length === 0) { offTimeoffConfig.push('Dead'); offTimeoffConfig.push('RSG Vacation') }

// project_exceptions lookup: lowercase float_project → { monday_project, pm_override }
const projExcMap = {}
for (const row of projectExceptions) {
  const fp = (row.float_project || '').trim().toLowerCase()
  if (fp) projExcMap[fp] = { monday_project: row.monday_project || '', pm_override: row.pm_override || '' }
}

// PM Discord lookup: pm_name → "<@discord_id>"
const pmDiscord = {}
for (const row of pmDiscordRows) {
  const name = (row.pm_name || '').trim()
  const id   = (row.discord_id || '').trim()
  if (name && id) pmDiscord[name] = `<@${id}>`
}
// Reverse: mention → pm_name
const discordToPm = {}
for (const [k, v] of Object.entries(pmDiscord)) discordToPm[v] = k

console.log(`Config: ${Object.keys(maxHoursConfig).length} max_hours | ${skipTagsConfig.length} skip tags | ${offTimeoffConfig.length} off timeoffs`)
console.log(`Project exceptions: ${Object.keys(projExcMap).length} | PM Discord: ${Object.keys(pmDiscord).length}`)

// ─── Monday: project → PM mapping ───────────────────────────────────────────
async function loadMondayProjects() {
  if (!MONDAY_TOKEN) { console.warn('⚠️ MONDAY_TOKEN not set — no PM tags'); return {} }
  const query = JSON.stringify({
    query: `{ boards(ids: [2475547910]) { items_page(limit: 500) { items { name group { title } column_values(ids: ["people"]) { id text } } } } }`
  })
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': MONDAY_TOKEN, 'Content-Type': 'application/json' },
    body: query,
  })
  if (!res.ok) { console.warn(`⚠️ Monday API → ${res.status}`); return {} }
  const json = await res.json()
  const map  = {}
  for (const item of (json?.data?.boards?.[0]?.items_page?.items || [])) {
    if (item.group?.title === 'Canceled') continue
    const pmRaw = item.column_values?.find(c => c.id === 'people')?.text
    if (pmRaw) {
      const pmName = pmRaw.split(',')[0].trim().replace(/\s*PM\s*$/, '')
      map[item.name.toLowerCase()] = pmName
    }
  }
  console.log(`Monday: loaded ${Object.keys(map).length} projects`)
  return map
}

// ─── Adjacent workday helpers ────────────────────────────────────────────────
function prevWorkDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  const offset = d.getUTCDay() === 1 ? -3 : -1
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
function nextWorkDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  const offset = d.getUTCDay() === 5 ? 3 : 1
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
function fmtDay(dateStr) {
  return dateStr.slice(8, 10) + '.' + dateStr.slice(5, 7)
}

// ─── Task skip logic (for adjacent hints + project id collection) ─────────────
const SKIP_EXACT_ADJ = new Set(['art direction', 'rsg org', 'tech support', 'playables \\ creatives pm support'])
function isSkipTask(name) {
  const norm = name.replace(/^[^\x00-\x7F]+\s*/, '').toLowerCase().trim()
  return /QA/i.test(name) || SKIP_EXACT_ADJ.has(norm)
}

// ─── PM mention resolution ───────────────────────────────────────────────────
function getPmMention(floatProjectName, projectPmMap) {
  if (!floatProjectName) return null
  const fpLower = floatProjectName.toLowerCase().trim()

  // 1. project_exceptions
  let exc = null
  for (const [key, val] of Object.entries(projExcMap)) {
    if (fpLower.includes(key) || key.includes(fpLower)) { exc = val; break }
  }
  if (exc) {
    if (exc.pm_override) {
      const tags = exc.pm_override.split(',').map(s => s.trim())
        .map(n => pmDiscord[n]).filter(Boolean)
      return tags.length ? tags.join(' ') : null
    }
    if (exc.monday_project) {
      const alt = exc.monday_project.toLowerCase().trim()
      const norm = alt.replace(/[^a-z0-9 ]/g, '').trim()
      for (const [k, pmName] of Object.entries(projectPmMap)) {
        const kn = k.replace(/[^a-z0-9 ]/g, '').trim()
        if (norm.includes(kn) || kn.includes(norm)) return pmDiscord[pmName] || null
      }
      return null
    }
  }

  // 2. Normal Monday lookup
  if (!Object.keys(projectPmMap).length) return null
  const norm = fpLower.replace(/[^a-z0-9 ]/g, '').trim()
  for (const [k, pmName] of Object.entries(projectPmMap)) {
    const kn = k.replace(/[^a-z0-9 ]/g, '').trim()
    if (norm.includes(kn) || kn.includes(norm)) return pmDiscord[pmName] || null
  }
  return null
}

// ─── Discord chunked send ────────────────────────────────────────────────────
async function sendDiscord(webhookUrl, message) {
  const lines  = message.split('\n')
  const chunks = []
  let cur      = ''
  for (const ln of lines) {
    const candidate = cur ? cur + '\n' + ln : ln
    if (candidate.length > 1900) {
      if (cur) chunks.push(cur)
      cur = ln
    } else {
      cur = candidate
    }
  }
  if (cur) chunks.push(cur)

  console.log(`Sending ${chunks.length} chunk(s) to Discord...`)
  for (let i = 0; i < chunks.length; i++) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: chunks[i] }),
    })
    console.log(`  chunk ${i + 1}/${chunks.length}: ${res.status} (${chunks[i].length} chars)`)
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Discord error ${res.status}: ${t}`)
    }
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500))
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching Float data...')
  const [allPeople, tasks, timeoffs, floatProjects] = await Promise.all([
    floatGetAll('/people'),
    floatGetAll(`/tasks?start_date=${DATE}&end_date=${DATE}`),
    floatGetAll(`/timeoffs?start_date=${DATE}&end_date=${DATE}`),
    floatGetAll('/projects'),
  ])

  const projectNames = {}
  for (const p of floatProjects) projectNames[p.project_id] = p.name

  // Adjacent days
  const dateBefore = prevWorkDay(DATE)
  const dateAfter  = nextWorkDay(DATE)
  const [tasksBefore, tasksAfter] = await Promise.all([
    floatGetAll(`/tasks?start_date=${dateBefore}&end_date=${dateBefore}`),
    floatGetAll(`/tasks?start_date=${dateAfter}&end_date=${dateAfter}`),
  ])
  console.log(`Adjacent days: ${dateBefore} ← ${DATE} → ${dateAfter}`)

  // Helper: Float returns people_id=null for multi-person tasks, use people_ids array instead
  function getPersonIds(t) {
    return t.people_id ? [t.people_id] : (t.people_ids || [])
  }

  // Build adjacent tasks lookup: personId → { before: [], after: [] }
  const adjByPerson = {}
  for (const [dir, src] of [['before', tasksBefore], ['after', tasksAfter]]) {
    for (const t of src) {
      if (!t.hours || parseFloat(t.hours) < 2) continue
      if (isSkipTask(t.name || '')) continue
      for (const pid of getPersonIds(t)) {
        if (!adjByPerson[pid]) adjByPerson[pid] = { before: [], after: [] }
        adjByPerson[pid][dir].push({ hours: parseFloat(t.hours), projectId: t.project_id, taskName: t.name })
      }
    }
  }

  // 3-day task lookup for PM attribution: personId → all tasks across dayBefore + target + dayAfter
  const threeDayTasksByPerson = {}
  for (const t of [...tasks, ...tasksBefore, ...tasksAfter]) {
    for (const pid of getPersonIds(t)) {
      if (!threeDayTasksByPerson[pid]) threeDayTasksByPerson[pid] = []
      threeDayTasksByPerson[pid].push(t)
    }
  }

  // Monday project → PM
  const projectPmMap = await loadMondayProjects()

  // Filter artists
  const allDeptIds = new Set([...DEPT_2D, ...DEPT_3D])
  const artists = allPeople.filter(p => {
    if (!allDeptIds.has(p.department?.department_id)) return false
    if (p.active !== 1) return false
    if (/^⌛/.test(p.name || '')) return false
    // skip tags
    const tags = Array.isArray(p.tags) ? p.tags.map(t => t.name) :
                 p.tags ? [p.tags.name] : []
    if (skipTagsConfig.some(st => tags.includes(st))) return false
    return true
  })

  // Timeoff set
  const offSet = new Set()
  for (const to of timeoffs) {
    for (const pid of (to.people_ids || [])) offSet.add(pid)
  }

  // Aggregate tasks per person
  const byPerson = {}
  for (const t of tasks) {
    for (const pid of getPersonIds(t)) {
      if (!byPerson[pid]) byPerson[pid] = { hours: 0, hasTentative: false, projectIds: new Set() }
      byPerson[pid].hours += parseFloat(t.hours || 0)
      if (t.status === 1) byPerson[pid].hasTentative = true
      if (t.project_id && !isSkipTask(t.name || '')) byPerson[pid].projectIds.add(t.project_id)
    }
  }

  // Build section data
  const sections = {
    '2D': { flags: [], conflicting: [], noTasks: [], ok: 0, off: 0 },
    '3D': { flags: [], conflicting: [], noTasks: [], ok: 0, off: 0 },
  }

  // Sort artists by dept name then name
  artists.sort((a, b) => {
    const da = DEPT_NAMES[a.department?.department_id] || ''
    const db = DEPT_NAMES[b.department?.department_id] || ''
    return da.localeCompare(db) || (a.name || '').localeCompare(b.name || '')
  })

  for (const a of artists) {
    const pid       = a.people_id
    const cleanName = (a.name || '').replace(/^[⏳⌛🔄⚡]\s*/, '').trim()
    const dept      = DEPT_NAMES[a.department?.department_id] || ''
    const grp       = DEPT_2D.has(a.department?.department_id) ? '2D' : '3D'
    const sec       = sections[grp]

    if (offSet.has(pid)) { sec.off++; continue }

    const info = byPerson[pid] || { hours: 0, hasTentative: false, projectIds: new Set() }
    const hrs  = info.hours
    const tent = info.hasTentative

    // Resolve PM mentions — 3-day window: tag the PM with the most hours across dayBefore + target + dayAfter
    const pmHours = {}
    for (const t of (threeDayTasksByPerson[pid] || [])) {
      if (!t.project_id || isSkipTask(t.name || '')) continue
      const m = getPmMention(projectNames[t.project_id], projectPmMap)
      if (!m) continue
      pmHours[m] = (pmHours[m] || 0) + parseFloat(t.hours || 0)
    }
    const mentions = []
    if (Object.keys(pmHours).length > 0) {
      const maxH = Math.max(...Object.values(pmHours))
      for (const [pm, h] of Object.entries(pmHours)) {
        if (h === maxH) mentions.push(pm)
      }
    }

    // Adjacent lines builder
    function buildAdjLines(personId) {
      const lines = []
      if (!adjByPerson[personId]) return lines
      for (const [dir, dayLabel] of [['before', fmtDay(dateBefore)], ['after', fmtDay(dateAfter)]]) {
        for (const at of adjByPerson[personId][dir]) {
          const pm    = getPmMention(projectNames[at.projectId], projectPmMap)
          const pmStr = pm && !NO_MENTIONS ? ` | ${pm}` : ''
          lines.push(`  ↕ ${dayLabel}: ${at.taskName} (${at.hours}h)${pmStr} — можна поставити ${fmtDay(DATE)}?`)
        }
      }
      return lines
    }

    const isConflicting = mentions.length > 1

    // No real project tasks → noTasks
    if (info.projectIds.size === 0) {
      const hrsLabel = hrs > 0 ? ` - < 8h (${hrs}h)` : ' - not scheduled'
      sec.noTasks.push({ line: `* **${cleanName}** [${dept}]${hrsLabel}`, pms: [], adjLines: buildAdjLines(pid) })
      continue
    }

    // hrs=0 and no tentative → noTasks
    if (hrs === 0 && !tent) {
      const entry = { line: `* **${cleanName}** [${dept}] - not scheduled`, pms: mentions, adjLines: buildAdjLines(pid) }
      if (isConflicting) sec.conflicting.push({ ...entry, adjLines: undefined })
      else               sec.noTasks.push(entry)
      continue
    }

    const maxHours = maxHoursConfig[cleanName] ?? 8
    const issues   = []
    if (hrs < 8)             issues.push(`< 8h (${hrs}h)`)
    else if (hrs > maxHours) issues.push(`> ${maxHours}h (${hrs}h)`)
    if (tent)                issues.push('Tentative')

    if (issues.length > 0) {
      const entry = { line: `* **${cleanName}** [${dept}] - ${issues.join(' / ')}`, pms: mentions }
      if (isConflicting) sec.conflicting.push(entry)
      else               sec.flags.push(entry)
    } else {
      sec.ok++
    }
  }

  // ─── Build message ──────────────────────────────────────────────────────────
  const [d, m, y] = [DATE.slice(8, 10), DATE.slice(5, 7), DATE.slice(0, 4)]
  const dateDisplay = `${d}.${m}.${y}`
  const msgLines = [`# 📋 Float check — ${dateDisplay}`]

  for (const grp of ['2D', '3D']) {
    const sec = sections[grp]
    msgLines.push('', `## ${grp}`, '')

    // Group flags by PM
    const byPm = {}
    for (const item of sec.flags) {
      const pmList = item.pms.length > 0 ? item.pms : ['__no_pm__']
      for (const pm of pmList) {
        if (!byPm[pm]) byPm[pm] = []
        byPm[pm].push(item.line)
      }
    }

    const hasAny = Object.keys(byPm).length > 0 || sec.conflicting.length > 0 || sec.noTasks.length > 0
    if (!hasAny) {
      msgLines.push('✅ **Без проблем**')
    } else {
      // PM groups sorted desc by count
      const sortedPms = Object.keys(byPm)
        .filter(k => k !== '__no_pm__')
        .sort((a, b) => byPm[b].length - byPm[a].length)

      for (const pm of sortedPms) {
        const pmLabel = NO_MENTIONS && discordToPm[pm] ? discordToPm[pm] : pm
        msgLines.push(`**${pmLabel}**`)
        byPm[pm].forEach(l => msgLines.push(l))
        msgLines.push('')
      }

      // Conflicting
      if (sec.conflicting.length > 0) {
        msgLines.push(`**⚠️ Conflicting tasks (${sec.conflicting.length}):**`)
        for (const item of sec.conflicting) {
          const pmStr = item.pms.length > 0 && !NO_MENTIONS ? ` | ${item.pms.join(' ')}` : ''
          msgLines.push(`${item.line}${pmStr}`)
        }
        msgLines.push('')
      }

      // Не заплановані
      if (sec.noTasks.length > 0) {
        msgLines.push(`**🚫 Не заплановані (${sec.noTasks.length}):**`)
        for (const item of sec.noTasks) {
          const pmStr = item.pms.length > 0 && !NO_MENTIONS ? ` | ${item.pms.join(' ')}` : ''
          msgLines.push(`${item.line}${pmStr}`)
          if (item.adjLines) item.adjLines.forEach(al => msgLines.push(al))
        }
        msgLines.push('')
      }

      // No PM assigned
      if (byPm['__no_pm__']) {
        msgLines.push(`**❓ No PM assigned (${byPm['__no_pm__'].length}):**`)
        byPm['__no_pm__'].forEach(l => msgLines.push(l))
        msgLines.push('')
      }
    }

    msgLines.push(`✅ OK: ${sec.ok} | 🏖️ Off/Dead: ${sec.off}`)
  }

  const message = msgLines.join('\n')
  console.log('\n' + message)
  console.log(`\nMessage length: ${message.length} chars`)

  if (WEBHOOK_URL) {
    await sendDiscord(WEBHOOK_URL, message)
    console.log('✅ Discord sent')
  } else {
    console.log('ℹ️ No webhook URL — printed to console only')
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
