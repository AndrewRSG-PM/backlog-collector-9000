#!/usr/bin/env node
// float-check.js — Node.js port of float-check.ps1
// Reads config from config/*.json (repo), env: FLOAT_API_KEY,
// DISCORD_WEBHOOK_PROD, DISCORD_WEBHOOK_TEST
// Inputs (via env from workflow): TARGET_DATE, NO_MENTIONS, TEST_MODE, MORNING_MODE

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
const MORNING_MODE  = process.env.MORNING_MODE === 'true'
const FLOAT_API_KEY = process.env.FLOAT_API_KEY || ''
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
const skipTagsConfig   = []  // tag names to skip the PERSON entirely (fixed-price artists)
const offTimeoffConfig = []  // timeoff type names to count as off
// Name patterns → skip the PERSON entirely (fixed-price artists). Both hourglass
// variants are built-in defaults so we never regress: ⌛ U+231B and ⏳ U+23F3.
// Matched with String.includes (UI promises "містить"), not startsWith.
const skipNamePatterns = ['⌛', '⏳']

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
  } else if (type === 'name_pattern' && value === 'skip_entirely') {
    if (!skipNamePatterns.includes(name)) skipNamePatterns.push(name)
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

// PM Discord lookups
// pmDiscordByFloat: float_name → "<@discord_id>"  (for Float project_manager matching)
// pmDiscordByName:  pm_name   → "<@discord_id>"  (for pm_override matching)
// discordToPm:      mention   → pm_name (real name, for noMentions display)
const pmDiscordByFloat = {}
const pmDiscordByName  = {}
const discordToPm      = {}
for (const row of pmDiscordRows) {
  const floatName = (row.float_name || row.pm_name || '').trim()
  const realName  = (row.pm_name || '').trim()
  const id        = (row.discord_id || '').trim()
  if (!id) continue
  const mention = `<@${id}>`
  if (floatName) pmDiscordByFloat[floatName] = mention
  if (realName)  pmDiscordByName[realName]   = mention
  if (realName)  discordToPm[mention]        = realName
}
// Keep pmDiscord as alias for pm_override lookups (backwards compat)
const pmDiscord = pmDiscordByName

console.log(`Config: ${Object.keys(maxHoursConfig).length} max_hours | ${skipTagsConfig.length} skip tags | ${offTimeoffConfig.length} off timeoffs`)
console.log(`Project exceptions: ${Object.keys(projExcMap).length} | PM Discord: ${Object.keys(pmDiscord).length}`)


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

// ─── Per-person work schedule ─────────────────────────────────────────────────
// Float `work_days_hours` is Sunday-indexed: [Sun, Mon, Tue, Wed, Thu, Fri, Sat].
// `work_days_hours_history` holds dated overrides ({ "YYYY-MM-DD": [...] }); the
// top-level field can be STALE after a schedule change, so always resolve the
// latest history entry <= target date. Returns true if DATE is a 0-hour day for
// this person (e.g. a 4-day week where Friday is non-working).
const TARGET_DOW = new Date(DATE + 'T12:00:00Z').getUTCDay()  // 0=Sun … 6=Sat
function isNonWorkingDay(person) {
  const hist = person.work_days_hours_history
  let arr = person.work_days_hours
  if (hist && typeof hist === 'object') {
    const keys = Object.keys(hist).filter(k => k <= DATE).sort()
    if (keys.length) arr = hist[keys[keys.length - 1]]
  }
  if (!Array.isArray(arr) || arr.length < 7) return false
  return parseFloat(arr[TARGET_DOW] || 0) === 0
}

// ─── Task counting policy ─────────────────────────────────────────────────────
// Float Check counts EVERY task in HOURS, regardless of name (QA, Art Direction,
// overheads — all real hours). A person is "off" only on a timeoff / non-working day.
// But QA & overhead do NOT count as "coverage" of the day — they are hours, not
// production. Used in three narrow spots (never in the raw hour total):
//  (1) QA never suggested as a movable task in adjacent-day hints;
//  (2) QA excluded from PM tagging on OVERLOAD (won't move) — unless the day's single
//      task is a QA task > 8h (then that QA IS the overload → tag its PM);
//  (3) coverage (production hours) = total minus QA+overhead → drives underload.
const normName = (name) => (name || '').replace(/^[^\x00-\x7F]+\s*/, '').toLowerCase().trim()
const OVERHEAD_EXACT = new Set(['art direction', 'rsg org', 'tech support', 'playables \\ creatives pm support'])
// Real production tasks that merely contain "QA" and must NOT be treated as QA/overhead.
const NEVER_QA = new Set(['export + qa'])
const isQaTask   = (name) => !NEVER_QA.has(normName(name)) && /QA/i.test(name || '')
const isOverhead = (name) => !NEVER_QA.has(normName(name)) && (/QA/i.test(name || '') || OVERHEAD_EXACT.has(normName(name)))

// ─── PM mention resolution ───────────────────────────────────────────────────
// Priority 1: project_exceptions → pm_override (manual)
// Priority 2: Float project_manager → pm_discord (by exact name)
// Populated in main() after Float data is loaded
const projectManagerMap = {}

function getPmMention(projectId, floatProjectName) {
  // 1. project_exceptions → pm_override
  if (floatProjectName) {
    const fpLower = floatProjectName.toLowerCase().trim()
    for (const [key, val] of Object.entries(projExcMap)) {
      if (fpLower.includes(key) || key.includes(fpLower)) {
        if (val.pm_override) {
          const tags = val.pm_override.split(',').map(s => s.trim())
            .map(n => pmDiscord[n]).filter(Boolean)
          return tags.length ? tags.join(' ') : null
        }
        break
      }
    }
  }

  // 2. Float project_manager
  if (projectId && projectManagerMap[projectId]) {
    return projectManagerMap[projectId]
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
  const [allPeople, allAccounts, tasks, timeoffs, floatProjects] = await Promise.all([
    floatGetAll('/people'),
    floatGetAll('/accounts'),
    floatGetAll(`/tasks?start_date=${DATE}&end_date=${DATE}`),
    floatGetAll(`/timeoffs?start_date=${DATE}&end_date=${DATE}`),
    floatGetAll('/projects'),
  ])

  const projectNames = {}
  for (const p of floatProjects) projectNames[p.project_id] = p.name

  // Build people lookup: people_id → person
  const peopleById = {}
  for (const p of allPeople) peopleById[p.people_id] = p

  // Build accounts lookup: account_id → account (PMs live here, not in /people)
  const accountsById = {}
  for (const a of allAccounts) {
    const id = a.account_id || a.id
    if (id) accountsById[id] = a
  }

  // Build project → PM mention map from Float project_manager field
  // project_manager references an account_id, not people_id
  for (const proj of floatProjects) {
    if (!proj.project_manager) continue
    const manager = accountsById[proj.project_manager]
    if (!manager) continue
    const rawName = manager.name || `${manager.first_name || ''} ${manager.last_name || ''}`.trim()
    const cleanName = rawName.replace(/^[⏳⌛🔄⚡⭐]\s*/, '').trim()
    const mention = pmDiscordByFloat[cleanName]
    if (mention) projectManagerMap[proj.project_id] = mention
  }

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
      if (isQaTask(t.name)) continue  // rule 1: never suggest moving QA to fill a gap
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


  // Filter artists
  const allDeptIds = new Set([...DEPT_2D, ...DEPT_3D])
  const artists = allPeople.filter(p => {
    if (!allDeptIds.has(p.department?.department_id)) return false
    if (p.active !== 1) return false
    if (skipNamePatterns.some(pat => (p.name || '').includes(pat))) return false
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
  const tasksByPerson = {}  // pid → [tasks] (for duplicate detection)
  for (const t of tasks) {
    for (const pid of getPersonIds(t)) {
      if (!byPerson[pid]) byPerson[pid] = { hours: 0, hasTentative: false, projectIds: new Set() }
      byPerson[pid].hours += parseFloat(t.hours || 0)
      if (t.status === 1) byPerson[pid].hasTentative = true
      if (t.project_id) byPerson[pid].projectIds.add(t.project_id)
      if (!tasksByPerson[pid]) tasksByPerson[pid] = []
      tasksByPerson[pid].push(t)
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

    // Non-working day per this person's Float work schedule (e.g. 4-day week) →
    // count as off, don't flag as unscheduled/under-loaded.
    if (isNonWorkingDay(a)) { sec.off++; continue }

    const info = byPerson[pid] || { hours: 0, hasTentative: false, projectIds: new Set() }
    const hrs  = info.hours
    const tent = info.hasTentative

    // Resolve PM mentions — 3-day window: tag the PM with the most hours across dayBefore + target + dayAfter.
    // pmHoursNoQa = excluding QA (overload tagging); pmHoursProd = excluding QA+overhead (underload tagging).
    const pmHours = {}
    const pmHoursNoQa = {}
    const pmHoursProd = {}
    for (const t of (threeDayTasksByPerson[pid] || [])) {
      if (!t.project_id) continue
      const m = getPmMention(t.project_id, projectNames[t.project_id])
      if (!m) continue
      const h = parseFloat(t.hours || 0)
      pmHours[m] = (pmHours[m] || 0) + h
      if (!isQaTask(t.name))   pmHoursNoQa[m] = (pmHoursNoQa[m] || 0) + h
      if (!isOverhead(t.name)) pmHoursProd[m] = (pmHoursProd[m] || 0) + h
    }
    const dominantOf = (map) => {
      const keys = Object.keys(map)
      if (!keys.length) return []
      const maxH = Math.max(...Object.values(map))
      return keys.filter(pm => map[pm] === maxH)
    }
    const mentions     = dominantOf(pmHours)
    const prodMentions = dominantOf(pmHoursProd)   // underload: production PMs only
    // Overload PM tags: drop QA-derived PMs (QA won't move) — unless the day's single
    // task is a QA task > 8h, in which case that QA IS the overload → tag normally.
    const todayTasks  = tasksByPerson[pid] || []
    const singleBigQa = todayTasks.length === 1 && isQaTask(todayTasks[0].name) && parseFloat(todayTasks[0].hours || 0) > 8
    const overloadMentions = singleBigQa ? mentions : dominantOf(pmHoursNoQa)

    // Adjacent lines builder
    function buildAdjLines(personId) {
      const lines = []
      if (!adjByPerson[personId]) return lines
      for (const [dir, dayLabel] of [['before', fmtDay(dateBefore)], ['after', fmtDay(dateAfter)]]) {
        for (const at of adjByPerson[personId][dir]) {
          const pm    = getPmMention(at.projectId, projectNames[at.projectId])
          const pmStr = pm && !NO_MENTIONS ? ` | ${pm}` : ''
          lines.push(`  ↕ ${dayLabel}: ${at.taskName} (${at.hours}h)${pmStr} — можна поставити ${fmtDay(DATE)}?`)
        }
      }
      return lines
    }

    const maxHours = maxHoursConfig[cleanName] ?? 8

    // UNDERLOAD: strictly < 8h total in the plan → flag (task type is irrelevant here).
    // Show adjacent hints (QA excluded) and tag the PRODUCTION PM — a QA/overhead PM
    // can't fill the gap, so if there is no production task, no PM is tagged.
    if (hrs < 8) {
      const label = hrs === 0 ? ' - not scheduled' : ` - < 8h (${hrs}h)`
      const entry = { line: `* **${cleanName}** [${dept}]${label}`, pms: prodMentions, adjLines: buildAdjLines(pid) }
      if (prodMentions.length > 1) sec.conflicting.push({ ...entry, adjLines: undefined })
      else                         sec.noTasks.push(entry)
      continue
    }

    // OVERLOAD: total hours over cap. Tag excludes QA (won't move).
    if (hrs > maxHours) {
      const issues = [`> ${maxHours}h (${hrs}h)`]
      if (tent) issues.push('Tentative')
      const entry = { line: `* **${cleanName}** [${dept}] - ${issues.join(' / ')}`, pms: overloadMentions }
      if (overloadMentions.length > 1) sec.conflicting.push(entry)
      else                             sec.flags.push(entry)
      continue
    }

    // Covered enough (5–8h production, not over cap). Only tentative worth flagging.
    if (tent) {
      const entry = { line: `* **${cleanName}** [${dept}] - Tentative`, pms: mentions }
      if (mentions.length > 1) sec.conflicting.push(entry)
      else                     sec.flags.push(entry)
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
        const pmLabel = NO_MENTIONS
          ? pm.split(/\s+/).map(m => discordToPm[m] || m).join(' ')
          : pm
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

      // Недовантажені / не заплановані (недобір продакшну > 3h)
      if (sec.noTasks.length > 0) {
        msgLines.push(`**🚫 Недовантажені / не заплановані (${sec.noTasks.length}):**`)
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

  // Duplicate tasks in Float: exact same name + same project for one artist on the date.
  // Keyed by name+project_id, so the same name on different projects is NOT a dup.
  const dupLines = []
  for (const a of artists) {
    const pid       = a.people_id
    const cleanName = (a.name || '').replace(/^[⏳⌛🔄⚡]\s*/, '').trim()
    const counts = {}
    for (const t of (tasksByPerson[pid] || [])) {
      const tn = (t.name || '').trim()
      if (!tn) continue
      const key = `${tn.toLowerCase()}|${t.project_id || ''}`
      if (!counts[key]) counts[key] = { name: tn, project: projectNames[t.project_id] || '', n: 0 }
      counts[key].n++
    }
    for (const c of Object.values(counts)) {
      if (c.n > 1) dupLines.push(`— ${cleanName}: "${c.name}" ×${c.n}${c.project ? ` (${c.project})` : ''}`)
    }
  }
  if (dupLines.length > 0) {
    msgLines.push('')
    msgLines.push(`**📑 Дублі задач у Float (${dupLines.length}):**`)
    dupLines.forEach(l => msgLines.push(l))
    msgLines.push('Перевірте, чи дубль не помилка планування.')
  }

  const message = msgLines.join('\n')
  console.log('\n' + message)
  console.log(`\nMessage length: ${message.length} chars`)

  if (WEBHOOK_URL) {
    const morningHeader = MORNING_MODE
      ? '🌅 Ранкова перевірка!\nОновіть Float:\n- перевірте задачі своїх художників на сьогодні\n- якщо вчора не оновили плани — будь ласка, зробіть це зараз\n\n'
      : ''
    await sendDiscord(WEBHOOK_URL, morningHeader + message)
    console.log('✅ Discord sent')
  } else {
    console.log('ℹ️ No webhook URL — printed to console only')
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
