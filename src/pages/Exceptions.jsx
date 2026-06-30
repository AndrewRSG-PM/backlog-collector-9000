import React, { useState, useEffect, useRef } from 'react'
import { readConfigFile, writeConfigFile } from '../lib/github'

// ─── Float Check ─────────────────────────────────────────────────────────────

const FLOAT_TYPE_OPTIONS = [
  {
    value: 'max_hours',
    label: 'Максимум годин/день',
    nameLabel: "Ім'я художника",
    namePlaceholder: 'Danylo Panchenko',
    valueType: 'number',
    valueFixed: null,
    effectLabel: null,
  },
  {
    value: 'name_pattern',
    label: 'Пропустити художника',
    nameLabel: 'Паттерн в імені',
    namePlaceholder: '⏳',
    valueType: 'fixed',
    valueFixed: 'skip_entirely',
    effectLabel: 'пропустити повністю',
  },
  {
    value: 'tag_filter',
    label: 'Пропустити по тегу',
    nameLabel: 'Назва тегу',
    namePlaceholder: 'Fix Price',
    valueType: 'fixed',
    valueFixed: 'skip_entirely',
    effectLabel: 'пропустити повністю',
  },
  {
    value: 'skip_task',
    label: 'Пропустити задачу',
    nameLabel: 'Назва задачі',
    namePlaceholder: 'Art Direction',
    valueType: 'fixed',
    valueFixed: 'skip_entirely',
    effectLabel: 'пропустити повністю',
  },
  {
    value: 'timeoff_type',
    label: 'Тип відгулу / відпустки',
    nameLabel: 'Тип у Float',
    namePlaceholder: 'RSG Vacation',
    valueType: 'fixed',
    valueFixed: 'count_as_off',
    effectLabel: 'рахувати як відгул',
  },
]

function FloatCheckGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#1a2336]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-[#8191b6] hover:text-[#8191b6] transition-colors text-left"
      >
        <span className="tracking-wider text-xs">ЯК ЦЕ ПРАЦЮЄ</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-[#1a2336] space-y-3 text-xs text-[#93a2c2]">
          <p>Float Check щодня перевіряє завантаження художників і надсилає звіт у Discord. Помічає:</p>
          <ul className="space-y-1 ml-2">
            <li>• <span className="text-[#93a2c2]">&lt; 8h</span> — художник недозавантажений</li>
            <li>• <span className="text-[#93a2c2]">&gt; 8h</span> — перевантажений (якщо немає виключення)</li>
            <li>• <span className="text-yellow-700">Tentative</span> — задачі з непідтвердженим статусом</li>
          </ul>
          <p className="border-t border-[#1a2336] pt-3">Виключення в цій таблиці:</p>
          <ul className="space-y-1.5 ml-2">
            <li>• <span className="text-[#8191b6]">Максимум годин/день</span> — художник може мати більше 8h, це ок. Вкажи ліміт.</li>
            <li>• <span className="text-[#8191b6]">Пропустити художника</span> — якщо ім'я містить вказаний паттерн (напр. ⏳) — художник повністю ігнорується.</li>
            <li>• <span className="text-[#8191b6]">Пропустити по тегу</span> — задачі з цим тегом у Float ігноруються (напр. Fix Price).</li>
            <li>• <span className="text-[#8191b6]">Пропустити задачу</span> — задача з точно такою назвою не враховується у Float Check (не рахується як проект і не тегає PM, напр. Art Direction, RSG ORG). Тільки точний збіг назви.</li>
            <li>• <span className="text-[#8191b6]">Тип відгулу</span> — цей timeoff рахується як "недоступний", а не флагується як проблема.</li>
          </ul>
        </div>
      )}
    </div>
  )
}

function FloatCheckEditor({ file }) {
  const [rows, setRows] = useState(null)
  const [sha, setSha] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [file])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data, sha: fileSha } = await readConfigFile(file)
      setRows(Array.isArray(data) ? data : [])
      setSha(fileSha)
    } catch (e) {
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function addRow() {
    setRows([...rows, { name: '', type: 'max_hours', value: '8', applies_to: 'float_check', note: '' }])
  }

  function deleteRow(i) {
    setRows(rows.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, val) {
    setRows(rows.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, [field]: val }
      if (field === 'type') {
        const opt = FLOAT_TYPE_OPTIONS.find(o => o.value === val)
        if (opt?.valueFixed) updated.value = opt.valueFixed
        else if (opt?.valueType === 'number') updated.value = '8'
      }
      return updated
    }))
  }

  async function save() {
    if (!localStorage.getItem('bc9000_github_pat')) {
      setError('GitHub PAT not set. Go to Settings.')
      return
    }
    const normalized = rows.map(r => ({ ...r, applies_to: 'float_check' }))
    setSaving(true)
    setError(null)
    try {
      await writeConfigFile(file, normalized, sha, 'config: update float_check_exceptions')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-[#6f81ab] text-xs py-4">Завантаження...</div>

  return (
    <div className="space-y-4">
      <FloatCheckGuide />
      {error && (
        <div className="text-red-400 text-xs border border-red-900/40 px-3 py-2 bg-red-950/20">✕ {error}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#2b3a5e]">
              <th className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">ЗНАЧЕННЯ</th>
              <th className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">ТИП ВИКЛЮЧЕННЯ</th>
              <th className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">ЕФЕКТ</th>
              <th className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">ПРИМІТКА</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-[#6f81ab] py-6 text-center text-sm">— порожньо —</td></tr>
            )}
            {rows.map((row, i) => {
              const opt = FLOAT_TYPE_OPTIONS.find(o => o.value === row.type) || FLOAT_TYPE_OPTIONS[0]
              return (
                <tr key={i} className="border-b border-[#1a2336] hover:bg-[#131a2b] group">
                  {/* Name/value input */}
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={row.name || ''}
                      onChange={e => updateRow(i, 'name', e.target.value)}
                      placeholder={opt.namePlaceholder}
                      className="bg-transparent border border-transparent hover:border-[#2b3a5e] focus:border-[#44598c] text-[#dde6f5] px-3 py-2 text-sm font-mono focus:outline-none focus:bg-[#0e1220] w-48"
                    />
                  </td>
                  {/* Type dropdown */}
                  <td className="py-2 pr-3">
                    <select
                      value={row.type || 'max_hours'}
                      onChange={e => updateRow(i, 'type', e.target.value)}
                      className="bg-[#131a2b] border border-[#2b3a5e] text-[#c9d3e6] px-3 py-2 text-sm focus:outline-none focus:border-[#44598c] w-52"
                    >
                      {FLOAT_TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  {/* Effect */}
                  <td className="py-2 pr-3">
                    {opt.valueType === 'number' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={row.value || ''}
                          onChange={e => updateRow(i, 'value', e.target.value)}
                          className="w-16 bg-transparent border border-[#2b3a5e] focus:border-[#44598c] text-[#dde6f5] px-3 py-2 text-sm font-mono focus:outline-none focus:bg-[#0e1220] text-center"
                        />
                        <span className="text-[#8191b6] text-xs">год/день</span>
                      </div>
                    ) : (
                      <span className="text-[#6f81ab] text-xs italic px-1">{opt.effectLabel}</span>
                    )}
                  </td>
                  {/* Note */}
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={row.note || ''}
                      onChange={e => updateRow(i, 'note', e.target.value)}
                      placeholder="необов'язково"
                      className="bg-transparent border border-transparent hover:border-[#2b3a5e] focus:border-[#44598c] text-[#8191b6] px-3 py-2 text-xs font-mono focus:outline-none focus:bg-[#0e1220] w-40"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => deleteRow(i)}
                      className="text-[#6173a0] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2"
                    >✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={addRow} className="text-sm text-[#93a2c2] hover:text-[#a6b3cd] border border-[#2b3a5e] hover:border-[#44598c] px-4 py-2 transition-colors">+ ADD ROW</button>
        <button onClick={save} disabled={saving} className="text-sm tracking-wider border border-[#44598c] text-[#a6b3cd] hover:border-[#8191b6] hover:text-white px-5 py-2 transition-colors disabled:opacity-40">
          {saving ? '...' : saved ? '✓ ЗБЕРЕЖЕНО' : 'SAVE'}
        </button>
        <button onClick={load} className="text-xs text-[#6f81ab] hover:text-[#6f81ab] underline">reload</button>
        <span className="text-[#6173a0] text-[10px] ml-auto">{file}</span>
      </div>
    </div>
  )
}

// ─── Skip Tasks (merged exact + contains) ────────────────────────────────────

function SkipTasksEditor() {
  const [rows, setRows] = useState(null)
  const [shaExact, setShaExact] = useState(null)
  const [shaContain, setShaContain] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [exact, contain] = await Promise.all([
        readConfigFile('config/skip_tasks_exact.json'),
        readConfigFile('config/skip_tasks_contain.json'),
      ])
      setShaExact(exact.sha)
      setShaContain(contain.sha)
      const combined = [
        ...(exact.data || []).map(r => ({ name: r.task_name || '', match: 'exact', note: r.note || '' })),
        ...(contain.data || []).map(r => ({ name: r.substring || '', match: 'contains', note: r.note || '' })),
      ]
      setRows(combined)
    } catch (e) {
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function addRow() {
    setRows([...rows, { name: '', match: 'exact', note: '' }])
  }

  function deleteRow(i) {
    setRows(rows.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, val) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function save() {
    if (!localStorage.getItem('bc9000_github_pat')) {
      setError('GitHub PAT not set. Go to Settings.')
      return
    }
    const exactRows = rows.filter(r => r.match === 'exact').map(r => ({ task_name: r.name, note: r.note }))
    const containRows = rows.filter(r => r.match === 'contains').map(r => ({ substring: r.name, note: r.note }))
    setSaving(true)
    setError(null)
    try {
      await Promise.all([
        writeConfigFile('config/skip_tasks_exact.json', exactRows, shaExact, 'config: update skip_tasks_exact'),
        writeConfigFile('config/skip_tasks_contain.json', containRows, shaContain, 'config: update skip_tasks_contain'),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-[#6f81ab] text-xs py-4">Завантаження...</div>

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#8191b6]">
        Задачі в цьому списку не отримують Order в Monday.{' '}
        <span className="text-[#93a2c2]">Точний збіг</span> — повна назва задачі.{' '}
        <span className="text-[#93a2c2]">Містить</span> — будь-яка задача, де є цей підрядок (напр. "QA" пропустить і "QA", і "QA pass").
      </p>
      {error && (
        <div className="text-red-400 text-xs border border-red-900/40 px-3 py-2 bg-red-950/20">✕ {error}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#2b3a5e]">
              <th className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">НАЗВА ЗАДАЧІ</th>
              <th className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">ЗБІГ</th>
              <th className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">ПРИМІТКА</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="text-[#6f81ab] py-6 text-center text-sm">— порожньо —</td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#1a2336] hover:bg-[#131a2b] group">
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={row.name}
                    onChange={e => updateRow(i, 'name', e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[#2b3a5e] focus:border-[#44598c] text-[#dde6f5] px-3 py-2 text-sm font-mono focus:outline-none focus:bg-[#0e1220] w-64"
                  />
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={row.match}
                    onChange={e => updateRow(i, 'match', e.target.value)}
                    className="bg-[#131a2b] border border-[#2b3a5e] text-[#c9d3e6] px-3 py-2 text-sm focus:outline-none focus:border-[#44598c]"
                  >
                    <option value="exact">точний збіг</option>
                    <option value="contains">містить</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={row.note}
                    onChange={e => updateRow(i, 'note', e.target.value)}
                    placeholder="необов'язково"
                    className="bg-transparent border border-transparent hover:border-[#2b3a5e] focus:border-[#44598c] text-[#8191b6] px-3 py-2 text-xs font-mono focus:outline-none focus:bg-[#0e1220] w-40"
                  />
                </td>
                <td className="py-2">
                  <button onClick={() => deleteRow(i)} className="text-[#6173a0] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={addRow} className="text-sm text-[#93a2c2] hover:text-[#a6b3cd] border border-[#2b3a5e] hover:border-[#44598c] px-4 py-2 transition-colors">+ ADD ROW</button>
        <button onClick={save} disabled={saving} className="text-sm tracking-wider border border-[#44598c] text-[#a6b3cd] hover:border-[#8191b6] hover:text-white px-5 py-2 transition-colors disabled:opacity-40">
          {saving ? '...' : saved ? '✓ ЗБЕРЕЖЕНО' : 'SAVE'}
        </button>
        <button onClick={load} className="text-xs text-[#6f81ab] hover:text-[#6f81ab] underline">reload</button>
      </div>
    </div>
  )
}

// ─── PM Multi-Select ─────────────────────────────────────────────────────────

function PmMultiSelect({ value, onChange, availablePms }) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  const selected = value
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const remaining = availablePms.filter(pm => !selected.includes(pm))

  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX })
    }
    setOpen(o => !o)
  }

  function addPm(pm) {
    onChange([...selected, pm].join(', '))
    setOpen(false)
  }

  function removePm(pm) {
    onChange(selected.filter(s => s !== pm).join(', '))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-[200px] py-1">
      {selected.map(pm => (
        <span key={pm} className="inline-flex items-center gap-1 bg-[#1e1e1e] border border-[#34466e] text-[#c9d3e6] text-xs px-2 py-1">
          {pm}
          <button
            onClick={() => removePm(pm)}
            className="text-[#6173a0] hover:text-red-400 leading-none ml-0.5"
          >✕</button>
        </span>
      ))}
      {remaining.length > 0 && (
        <>
          <button
            ref={btnRef}
            onClick={toggleOpen}
            className="text-xs border border-dashed border-[#44598c] text-[#6f81ab] hover:text-[#a6b3cd] hover:border-[#6173a0] px-2 py-1 transition-colors"
          >+ PM</button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div
                className="fixed z-50 bg-[#141414] border border-[#2b3a5e] shadow-xl min-w-[180px]"
                style={{ top: dropPos.top, left: dropPos.left }}
              >
                {remaining.map(pm => (
                  <button
                    key={pm}
                    onClick={() => addPm(pm)}
                    className="block w-full text-left text-sm text-[#c9d3e6] hover:bg-[#1e1e1e] hover:text-white px-3 py-2 transition-colors"
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {selected.length === 0 && remaining.length === 0 && (
        <span className="text-[#51679c] text-xs italic">— немає PM —</span>
      )}
    </div>
  )
}

// ─── Project Exceptions Guide ────────────────────────────────────────────────

function ProjectExceptionsGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#1a2336]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-[#8191b6] hover:text-[#8191b6] transition-colors text-left"
      >
        <span className="tracking-wider text-xs">ЯК ЦЕ ПРАЦЮЄ</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs text-[#8191b6] space-y-3 border-t border-[#1a2336] pt-3">
          <p>
            Таблиця вирішує дві задачі: знаходить правильний Monday-проект для Float-проекту
            і/або призначає PM-овераїд для тегів у Float Check.
          </p>
          <ul className="space-y-2 ml-2">
            <li>
              • <span className="text-[#93a2c2]">Проект у Float</span> — частина або повна назва проекту у Float (регістр не важливий).
            </li>
            <li>
              • <span className="text-[#93a2c2]">Проект у Monday</span> — якщо назва у Float і Monday відрізняються, вкажи тут Monday-назву.
              Залиш порожнім якщо назви збігаються або потрібен тільки PM-овераїд.
            </li>
            <li>
              • <span className="text-[#93a2c2]">PM (override)</span> — один або кілька ПМів, яких буде тегнуто в Discord
              для цього проекту замість автоматичного пошуку в Monday.
              Потрібно якщо проекту немає в Monday, або якщо проект веде кілька ПМів.
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Generic table editor (for other tabs) ───────────────────────────────────

const COLUMN_LABELS = {
  float_name: "Ім'я у Float",
  monday_search: 'Пошук у Monday',
  float_project: 'Проект у Float',
  monday_project: 'Проект у Monday',
  pm_override: 'PM (override)',
  pm_name: 'Ім\'я PM',
  discord_id: 'Discord ID',
  note: 'Примітка',
}

function TableEditor({ config, availablePms = [] }) {
  const [rows, setRows] = useState(null)
  const [sha, setSha] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [config.file])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data, sha: fileSha } = await readConfigFile(config.file)
      setRows(Array.isArray(data) ? data : [])
      setSha(fileSha)
    } catch (e) {
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function addRow() { setRows([...rows, { ...config.placeholder }]) }
  function deleteRow(i) { setRows(rows.filter((_, idx) => idx !== i)) }
  function updateCell(rowIdx, col, val) {
    setRows(rows.map((r, i) => i === rowIdx ? { ...r, [col]: val } : r))
  }

  async function save() {
    if (!localStorage.getItem('bc9000_github_pat')) {
      setError('GitHub PAT not set. Go to Settings.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await writeConfigFile(config.file, rows, sha, `config: update ${config.key}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-[#6f81ab] text-xs py-4">Завантаження {config.file}...</div>

  return (
    <div className="space-y-3">
      {config.key === 'project_exceptions' && <ProjectExceptionsGuide />}
      {error && (
        <div className="text-red-400 text-xs border border-red-900/40 px-3 py-2 bg-red-950/20">✕ {error}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#2b3a5e]">
              {config.columns.map(col => (
                <th key={col} className="text-left text-[#8191b6] tracking-wider py-3 pr-4 font-normal text-xs">
                  {(COLUMN_LABELS[col] || col.replace(/_/g, ' ')).toUpperCase()}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={config.columns.length + 1} className="text-[#6f81ab] py-6 text-center text-sm">— порожньо —</td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#1a2336] hover:bg-[#131a2b] group">
                {config.columns.map(col => (
                  <td key={col} className="py-1.5 pr-3">
                    {col === 'pm_override' && config.columnTypes?.pm_override === 'pm_multi'
                      ? <PmMultiSelect
                          value={row[col] || ''}
                          onChange={val => updateCell(i, col, val)}
                          availablePms={availablePms}
                        />
                      : <input
                          type="text"
                          value={row[col] || ''}
                          onChange={e => updateCell(i, col, e.target.value)}
                          className="w-full bg-transparent border border-transparent hover:border-[#2b3a5e] focus:border-[#44598c] text-[#dde6f5] px-3 py-2 text-sm font-mono focus:outline-none focus:bg-[#0e1220] min-w-[160px]"
                        />
                    }
                  </td>
                ))}
                <td className="py-1.5">
                  <button
                    onClick={() => deleteRow(i)}
                    className="text-[#6173a0] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2"
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={addRow} className="text-sm text-[#93a2c2] hover:text-[#a6b3cd] border border-[#2b3a5e] hover:border-[#44598c] px-4 py-2 transition-colors">+ ADD ROW</button>
        <button onClick={save} disabled={saving} className="text-sm tracking-wider border border-[#44598c] text-[#a6b3cd] hover:border-[#8191b6] hover:text-white px-5 py-2 transition-colors disabled:opacity-40">
          {saving ? '...' : saved ? '✓ ЗБЕРЕЖЕНО' : 'SAVE'}
        </button>
        <button onClick={load} className="text-xs text-[#6f81ab] hover:text-[#6f81ab] underline">reload</button>
        <span className="text-[#6173a0] text-[10px] ml-auto">{config.file}</span>
      </div>
    </div>
  )
}

// ─── Tab config ──────────────────────────────────────────────────────────────

const SCOPES = {
  float:  { label: 'FLOAT CHECK — звіт у Discord', cls: 'bg-sky-950/50 text-sky-300 border-sky-800/50' },
  orders: { label: 'ORDER SYNC — ордери в Monday', cls: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50' },
  both:   { label: 'FLOAT CHECK + ORDER SYNC',      cls: 'bg-violet-950/50 text-violet-300 border-violet-800/50' },
}

function ScopeBadge({ scope }) {
  const s = SCOPES[scope]
  if (!s) return null
  return (
    <span className={`inline-block text-[11px] tracking-wider border rounded-md px-2 py-0.5 ${s.cls}`}>
      {s.label}
    </span>
  )
}

const TABS = [
  {
    key: 'float_check_exceptions',
    title: 'Завантаженість художників',
    scope: 'float',
    description: 'Виключення для звіту Float Check: максимум годин/день, пропуск художника чи тегу, типи відгулів. На ордери в Monday не впливає.',
    renderer: 'float_check',
    file: 'config/float_check_exceptions.json',
  },
  {
    key: 'name_exceptions',
    title: 'Імена Float ↔ Monday',
    scope: 'orders',
    description: "База розбіжностей імен для Order Sync: якщо ім'я художника у Float пишеться інакше, ніж у Monday — додай відповідність тут. На звіт Float Check не впливає.",
    renderer: 'table',
    file: 'config/name_exceptions.json',
    columns: ['float_name', 'monday_search', 'note'],
    placeholder: { float_name: 'Roman Alexeyechkin', monday_search: 'Alekseechkin', note: '' },
  },
  {
    key: 'skip_tasks',
    title: 'Задачі без ордера',
    scope: 'orders',
    description: 'Для Order Sync: ці задачі пропускаються при проставлянні Order у Monday (QA, синки, Art Direction тощо).',
    renderer: 'skip_tasks',
  },
  {
    key: 'project_exceptions',
    title: 'Проекти + PM Override',
    scope: 'both',
    description: 'Відповідність проекту Float → Monday (для ордерів) та pm_override — який PM тегається у звіті Float Check.',
    renderer: 'table',
    file: 'config/project_exceptions.json',
    columns: ['float_project', 'monday_project', 'pm_override', 'note'],
    columnTypes: { pm_override: 'pm_multi' },
    placeholder: { float_project: 'SpacePlay', monday_project: '', pm_override: '', note: '' },
  },
  {
    key: 'pm_discord',
    title: 'PM Discord ID',
    scope: 'float',
    description: "Ім'я PM → Discord user ID. Використовується для тегів PM у звіті Float Check.",
    renderer: 'table',
    file: 'config/pm_discord.json',
    columns: ['pm_name', 'discord_id', 'note'],
    placeholder: { pm_name: 'Andrew Holovko', discord_id: '1473964446652039168', note: '' },
  },
]

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Exceptions() {
  const [active, setActive] = useState(TABS[0].key)
  const [pmNames, setPmNames] = useState([])
  const tab = TABS.find(t => t.key === active)

  useEffect(() => {
    readConfigFile('config/pm_discord.json')
      .then(({ data }) => setPmNames((data || []).map(r => r.pm_name).filter(Boolean)))
      .catch(() => {})
  }, [])

  function renderContent() {
    if (!tab) return null
    if (tab.renderer === 'float_check') return <FloatCheckEditor file={tab.file} />
    if (tab.renderer === 'skip_tasks') return <SkipTasksEditor key="skip_tasks" />
    return <TableEditor key={tab.key} config={tab} availablePms={pmNames} />
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-[#6f81ab] tracking-widest mb-1">CONFIG MANAGEMENT</div>
        <h1 className="text-lg font-bold text-white tracking-wide">Exceptions</h1>
        <p className="text-xs text-[#8191b6] mt-1">
          Зміни комітяться в репо і підхоплюються наступним workflow run.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#1a2336] pb-3">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`text-sm tracking-wider px-4 py-2 rounded-lg border transition-colors ${
              active === t.key
                ? 'border-[#3b4f7c] text-white bg-[#1d2740]'
                : 'border-transparent text-[#8191b6] hover:text-[#c9d3e6] hover:bg-[#151d30]'
            }`}
          >
            {t.title}
            <span className={`ml-2 inline-block w-1.5 h-1.5 rounded-full align-middle ${
              t.scope === 'float' ? 'bg-sky-400' : t.scope === 'orders' ? 'bg-emerald-400' : 'bg-violet-400'
            }`} />
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {tab && (
        <div>
          <div className="mb-2"><ScopeBadge scope={tab.scope} /></div>
          <div className="text-sm text-[#8191b6] mb-4">{tab.description}</div>
          {renderContent()}
        </div>
      )}
    </div>
  )
}
