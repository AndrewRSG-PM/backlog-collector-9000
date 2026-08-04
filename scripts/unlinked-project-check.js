#!/usr/bin/env node
// unlinked-project-check.js — flag Float projects that HAVE tasks this week but are
// NOT fully linked on the Monday "@Float Project ID" board (empty 🚀Project List OR
// empty Link to Project board) → their names don't resolve → backlog tasks show up
// nameless. Pings the responsible PM (from Float project_manager) to link them.
// Read-only against Float + Monday; only posts a Discord report. Manual (workflow_dispatch).

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const FLOAT_API_KEY = process.env.FLOAT_API_KEY || ''
const MONDAY_TOKEN  = process.env.MONDAY_TOKEN  || ''
const TEST_MODE     = process.env.TEST_MODE === 'true'
const WEBHOOK_URL   = TEST_MODE ? (process.env.DISCORD_WEBHOOK_TEST || '') : (process.env.DISCORD_WEBHOOK_PROD || '')

if (!FLOAT_API_KEY) { console.error('❌ FLOAT_API_KEY not set'); process.exit(1) }
if (!MONDAY_TOKEN)  { console.error('❌ MONDAY_TOKEN not set');  process.exit(1) }

const BOARD_ID  = 3270734850          // Monday "@Float Project ID"
const NOTES_ID  = 4474644             // Float catch-all "NOTES" project — never a real project
const WINDOW_DAYS = 7                 // "this week" forward window

function loadJson(file) {
  try { return JSON.parse(readFileSync(join(ROOT, 'config', file), 'utf8')) }
  catch { return [] }
}

// ─── Float ─────────────────────────────────────────────────────────────────────
const FLOAT_HEADERS = { Authorization: `Bearer ${FLOAT_API_KEY}` }
async function floatGetAll(path) {
  const results = []
  let page = 1
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`https://api.float.com/v3${path}${sep}per-page=200&page=${page}`, { headers: FLOAT_HEADERS })
    if (!res.ok) throw new Error(`Float API ${path} → ${res.status} ${res.statusText}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    results.push(...data)
    if (data.length < 200) break
    page++
  }
  return results
}

// ─── Monday ──────────────────────────────────────────────────────────────────────
async function mondayQuery(query) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { Authorization: MONDAY_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
    body: JSON.stringify({ query }),
  })
  const data = await res.json()
  if (data.errors) throw new Error('Monday API: ' + JSON.stringify(data.errors))
  return data.data
}

// item.name (=Float project id) → { plLinked, linkFilled, name(=Float Project Name) }
async function fetchBoardMap() {
  const COLS = `column_values(ids:["connect_boards","link_mkqg8zqc","text"]){ id text ... on BoardRelationValue { linked_item_ids } }`
  const map = {}
  let cursor = null, first = true
  while (true) {
    const q = first
      ? `{ boards(ids:[${BOARD_ID}]) { items_page(limit:200) { cursor items { name ${COLS} } } } }`
      : `{ next_items_page(cursor:"${cursor}", limit:200) { cursor items { name ${COLS} } } }`
    const d = await mondayQuery(q)
    const page = first ? d.boards[0].items_page : d.next_items_page
    for (const it of page.items) {
      let plLinked = false, linkFilled = false, name = ''
      for (const cv of it.column_values) {
        if (cv.id === 'connect_boards')  plLinked   = (cv.linked_item_ids || []).length > 0
        if (cv.id === 'link_mkqg8zqc')   linkFilled = !!(cv.text && cv.text.trim())
        if (cv.id === 'text')            name       = (cv.text || '').trim()
      }
      map[String(it.name).trim()] = { plLinked, linkFilled, name }
    }
    cursor = page.cursor
    first = false
    if (!cursor) break
  }
  return map
}

// ─── PM resolution (Float project_manager → account → pm_discord) ──────────────────
const pmDiscordByFloat = {}
for (const row of loadJson('pm_discord.json')) {
  const fn = (row.float_name || row.pm_name || '').trim()
  const id = (row.discord_id || '').trim()
  if (fn && id) pmDiscordByFloat[fn] = `<@${id}>`
}

// ─── Discord ───────────────────────────────────────────────────────────────────────
async function sendDiscord(webhookUrl, message) {
  const lines = message.split('\n'); const chunks = []; let cur = ''
  for (const ln of lines) {
    const cand = cur ? cur + '\n' + ln : ln
    if (cand.length > 1900) { if (cur) chunks.push(cur); cur = ln } else cur = cand
  }
  if (cur) chunks.push(cur)
  for (let i = 0; i < chunks.length; i++) {
    const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: chunks[i] }) })
    if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`)
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500))
  }
}

function weekWindow() {
  const d = new Date()
  const start = d.toISOString().slice(0, 10)
  const e = new Date(); e.setDate(e.getDate() + WINDOW_DAYS)
  return { start, end: e.toISOString().slice(0, 10) }
}

// ─── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  const { start, end } = weekWindow()
  console.log(`Unlinked project check — tasks window ${start}..${end}`)

  const [tasks, projects, accounts] = await Promise.all([
    floatGetAll(`/tasks?start_date=${start}&end_date=${end}`),
    floatGetAll('/projects'),
    floatGetAll('/accounts'),
  ])
  const projById = {}; for (const p of projects) projById[p.project_id] = p
  const accById  = {}; for (const a of accounts) { const id = a.account_id || a.id; if (id) accById[id] = a }

  // task count per project in the window
  const taskCount = {}
  for (const t of tasks) { if (t.project_id) taskCount[t.project_id] = (taskCount[t.project_id] || 0) + 1 }

  const boardMap = await fetchBoardMap()
  // ignore rows: either a bare Float id, or { float_id, name } for readability
  const ignore = new Set((loadJson('unlinked_ignore.json') || []).map(r => String((r && typeof r === 'object') ? (r.float_id ?? r.id) : r)))

  const flags = []  // { name, id, count, pm }
  for (const [pidStr, count] of Object.entries(taskCount)) {
    const pid = Number(pidStr)
    if (pid === NOTES_ID || ignore.has(pidStr)) continue
    const item = boardMap[pidStr]
    const unlinked = !item || !item.plLinked || !item.linkFilled
    if (!unlinked) continue

    const proj = projById[pid]
    const name = (proj && proj.name) || (item && item.name) || pidStr
    let pm = null
    if (proj && proj.project_manager) {
      const mgr = accById[proj.project_manager]
      if (mgr) {
        const raw = mgr.name || `${mgr.first_name || ''} ${mgr.last_name || ''}`.trim()
        const clean = raw.replace(/^[⏳⌛🔄⚡⭐]\s*/, '').trim()
        pm = pmDiscordByFloat[clean] || null
      }
    }
    flags.push({ name, id: pidStr, count, pm })
  }

  // ─── Build message ───────────────────────────────────────────────────────────
  const lines = []
  if (flags.length === 0) {
    lines.push('✅ Усі проєкти з задачами на тиждень звʼязані у «@Float Project ID».')
  } else {
    lines.push(`🔗 **Незвʼязані проєкти з задачами на тиждень (${flags.length})** — не привʼязані у «@Float Project ID» → назви НЕ показуються, задачі летять безіменні.`)
    lines.push('')
    const byPm = {}
    for (const f of flags) { const k = f.pm || '__no_pm__'; (byPm[k] = byPm[k] || []).push(f) }
    const pmKeys = Object.keys(byPm).filter(k => k !== '__no_pm__').sort((a, b) => byPm[b].length - byPm[a].length)
    for (const pm of pmKeys) {
      lines.push(pm)
      for (const f of byPm[pm].sort((a, b) => b.count - a.count)) lines.push(`— ${f.name} (Float id ${f.id}, задач: ${f.count})`)
      lines.push('')
    }
    if (byPm['__no_pm__']) {
      lines.push('**❓ Овнер невідомий:**')
      for (const f of byPm['__no_pm__'].sort((a, b) => b.count - a.count)) lines.push(`— ${f.name} (Float id ${f.id}, задач: ${f.count})`)
      lines.push('')
    }
    lines.push('Як пофіксити: борд «@Float Project ID» → відкрий айтем → заповни **Link to Project board** (прилінкуй відповідний проєкт).')
  }
  const message = lines.join('\n')
  console.log('\n' + message)

  if (WEBHOOK_URL) { await sendDiscord(WEBHOOK_URL, message); console.log('\n✅ Discord sent') }
  else console.log('\nℹ️ No webhook URL — printed to console only')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
