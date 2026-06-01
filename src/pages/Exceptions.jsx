import { useState, useEffect } from 'react'
import { readConfigFile, writeConfigFile } from '../lib/github'

const CONFIGS = [
  {
    key: 'float_check_exceptions',
    file: 'config/float_check_exceptions.json',
    title: 'Float Check',
    description: 'max_hours per artist, tag_filter, timeoff_type',
    columns: ['name', 'type', 'value', 'applies_to', 'note'],
    placeholder: { name: 'Bohdan', type: 'max_hours', value: '10', applies_to: 'float_check', note: '' },
  },
  {
    key: 'name_exceptions',
    file: 'config/name_exceptions.json',
    title: 'Name Exceptions',
    description: 'Float name → Monday search name',
    columns: ['float_name', 'monday_search', 'note'],
    placeholder: { float_name: 'Roman Alexeyechkin', monday_search: 'Alekseechkin', note: '' },
  },
  {
    key: 'skip_tasks_exact',
    file: 'config/skip_tasks_exact.json',
    title: 'Skip Tasks (exact)',
    description: 'Назви задач які не отримують Order (точний збіг)',
    columns: ['task_name', 'note'],
    placeholder: { task_name: 'Art Direction', note: '' },
  },
  {
    key: 'skip_tasks_contain',
    file: 'config/skip_tasks_contain.json',
    title: 'Skip Tasks (contains)',
    description: 'Підрядки — якщо задача містить, пропускається',
    columns: ['substring', 'note'],
    placeholder: { substring: 'QA', note: '' },
  },
  {
    key: 'project_exceptions',
    file: 'config/project_exceptions.json',
    title: 'Project Exceptions',
    description: 'Float project → Monday project або pm_override',
    columns: ['float_project', 'monday_project', 'pm_override', 'note'],
    placeholder: { float_project: 'SpacePlay', monday_project: '', pm_override: 'Andrew Holovko', note: '' },
  },
  {
    key: 'pm_discord',
    file: 'config/pm_discord.json',
    title: 'PM Discord',
    description: 'PM name → Discord user ID',
    columns: ['pm_name', 'discord_id', 'note'],
    placeholder: { pm_name: 'Andrew Holovko', discord_id: '1473964446652039168', note: '' },
  },
]

function TableEditor({ config }) {
  const [rows, setRows] = useState(null)
  const [sha, setSha] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load()
  }, [config.file])

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

  function addRow() {
    setRows([...rows, { ...config.placeholder }])
  }

  function deleteRow(i) {
    setRows(rows.filter((_, idx) => idx !== i))
  }

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
      // Refresh sha
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-[#444] text-xs py-4">Loading {config.file}...</div>

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-red-400 text-xs border border-red-900/40 px-3 py-2 bg-red-950/20">
          ✕ {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {config.columns.map(col => (
                <th key={col} className="text-left text-[#555] tracking-wider py-3 pr-4 font-normal text-sm">
                  {col.toUpperCase().replace(/_/g, ' ')}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={config.columns.length + 1} className="text-[#444] py-4 text-center">
                  — empty —
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#111] group">
                {config.columns.map(col => (
                  <td key={col} className="py-1.5 pr-3">
                    <input
                      type="text"
                      value={row[col] || ''}
                      onChange={e => updateCell(i, col, e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-[#2a2a2a] focus:border-[#444] text-[#e5e5e5] px-2 py-1.5 text-sm font-mono focus:outline-none focus:bg-[#0d0d0d] min-w-[160px]"
                    />
                  </td>
                ))}
                <td className="py-1.5">
                  <button
                    onClick={() => deleteRow(i)}
                    className="text-[#333] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={addRow}
          className="text-sm text-[#666] hover:text-[#aaa] border border-[#2a2a2a] hover:border-[#444] px-4 py-2 transition-colors"
        >
          + ADD ROW
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="text-sm tracking-wider border border-[#444] text-[#aaa] hover:border-[#888] hover:text-white px-5 py-2 transition-colors disabled:opacity-40"
        >
          {saving ? '...' : saved ? '✓ SAVED' : 'SAVE'}
        </button>
        <button
          onClick={load}
          className="text-xs text-[#444] hover:text-[#777] underline"
        >
          reload
        </button>
        <span className="text-[#333] text-[10px] ml-auto">{config.file}</span>
      </div>
    </div>
  )
}

export default function Exceptions() {
  const [active, setActive] = useState(CONFIGS[0].key)
  const config = CONFIGS.find(c => c.key === active)

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-[#444] tracking-widest mb-1">CONFIG MANAGEMENT</div>
        <h1 className="text-lg font-bold text-white tracking-wide">Exceptions</h1>
        <p className="text-xs text-[#555] mt-1">
          Зміни комітяться в репо і підхоплюються наступним workflow run.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#1a1a1a] pb-3">
        {CONFIGS.map(c => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={`text-sm tracking-wider px-4 py-2 border transition-colors ${
              active === c.key
                ? 'border-[#e5e5e5] text-white bg-[#1a1a1a]'
                : 'border-transparent text-[#555] hover:text-[#888] hover:border-[#333]'
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      {/* Active config */}
      {config && (
        <div>
          <div className="text-sm text-[#555] mb-4">{config.description}</div>
          <TableEditor key={config.key} config={config} />
        </div>
      )}
    </div>
  )
}
