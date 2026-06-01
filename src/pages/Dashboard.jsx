import { useState, useEffect, useCallback } from 'react'
import { dispatchWorkflow, getLatestRun } from '../lib/github'

const CODA_2D_URL = 'https://coda.io'  // TODO: fill in actual URL
const CODA_3D_URL = 'https://coda.io'  // TODO: fill in actual URL

const WORKFLOWS = {
  floatCheck: 'float-check.yml',
  orderSync: 'order-sync.yml',
}

function todayPlus1() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  // Skip to Monday if Saturday/Sunday
  if (d.getDay() === 6) d.setDate(d.getDate() + 2)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function StatusBadge({ status, conclusion }) {
  if (!status) return null
  if (status === 'queued' || status === 'in_progress') {
    return <span className="text-yellow-400 text-xs animate-pulse">● RUNNING</span>
  }
  if (status === 'completed') {
    if (conclusion === 'success') return <span className="text-green-400 text-xs">● DONE</span>
    return <span className="text-red-400 text-xs">● FAILED</span>
  }
  return null
}

function ActionButton({ label, onClick, disabled, variant = 'primary', className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-7 py-3.5 text-base tracking-wider font-bold border transition-all
        ${variant === 'primary'
          ? 'border-[#e5e5e5] text-white hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed'
          : 'border-[#444] text-[#888] hover:border-[#888] hover:text-[#ccc] disabled:opacity-30 disabled:cursor-not-allowed'
        }
        ${className}
      `}
    >
      {label}
    </button>
  )
}

function WorkflowCard({ title, description, workflowFile, inputs = {}, testMode = false, showDryRun = false }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [run, setRun] = useState(null)
  const [polling, setPolling] = useState(false)
  const [dryRun, setDryRun] = useState(false)

  const fetchRun = useCallback(async () => {
    try {
      const latest = await getLatestRun(workflowFile)
      setRun(latest)
    } catch (e) {
      // silently fail for status polling
    }
  }, [workflowFile])

  useEffect(() => {
    fetchRun()
  }, [fetchRun])

  // Poll while running
  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      await fetchRun()
      if (run?.status === 'completed') {
        setPolling(false)
        clearInterval(interval)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [polling, run, fetchRun])

  async function trigger() {
    setLoading(true)
    setError(null)
    try {
      await dispatchWorkflow(workflowFile, { ...inputs, test_mode: testMode ? 'true' : 'false', dry_run: dryRun ? 'true' : 'false' })
      // Wait a moment then start polling
      setTimeout(() => {
        fetchRun()
        setPolling(true)
      }, 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-[#2a2a2a] p-7 hover:border-[#333] transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-lg font-bold text-white tracking-wide mb-2">
            {title}
            {testMode && <span className="ml-3 text-sm text-yellow-500 border border-yellow-500/40 px-2 py-0.5">TEST</span>}
          </div>
          <div className="text-base text-[#666]">{description}</div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {showDryRun && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setDryRun(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${dryRun ? 'bg-yellow-600' : 'bg-[#2a2a2a]'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#e5e5e5] transition-transform ${dryRun ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className={`text-xs tracking-wider ${dryRun ? 'text-yellow-400' : 'text-[#444]'}`}>
                DRY RUN
              </span>
            </label>
          )}
          {run && <StatusBadge status={run.status} conclusion={run.conclusion} />}
          <ActionButton
            label={loading ? '...' : 'RUN'}
            onClick={trigger}
            disabled={loading}
            variant={testMode ? 'secondary' : 'primary'}
          />
        </div>
      </div>
      {error && (
        <div className="text-red-400 text-xs mt-2 border border-red-900/40 px-3 py-2 bg-red-950/20">
          ✕ {error}
          {error.includes('401') || error.includes('Bad credentials') ? (
            <span className="ml-2">— <a href="/guides" className="underline hover:text-red-300">Set GitHub PAT in Settings</a></span>
          ) : null}
        </div>
      )}
      {run && (
        <div className="mt-2 text-[10px] text-[#444] flex items-center gap-3">
          <span>Run #{run.run_number}</span>
          <span>{new Date(run.created_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}</span>
          {run.html_url && (
            <a href={run.html_url} target="_blank" rel="noreferrer" className="underline hover:text-[#777]">
              → view logs
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [date, setDate] = useState(todayPlus1())

  return (
    <div className="space-y-8">
      {/* Date selector */}
      <div>
        <div className="text-base text-[#555] tracking-wider mb-3">TARGET DATE</div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[#0d0d0d] border border-[#2a2a2a] text-[#e5e5e5] text-base px-5 py-3 font-mono focus:outline-none focus:border-[#555]"
          />
          <button
            onClick={() => setDate(todayPlus1())}
            className="text-xs text-[#444] hover:text-[#888] underline"
          >
            reset to tomorrow
          </button>
        </div>
      </div>

      {/* Section: Float */}
      <div>
        <div className="text-sm text-[#444] tracking-widest mb-5 flex items-center gap-3">
          <span>── FLOAT CHECK</span>
          <span className="flex-1 border-t border-[#1a1a1a]" />
        </div>
        <div className="space-y-2">
          <WorkflowCard
            title="Float Check"
            description="Перевіряє завантаження художників у Float, відправляє звіт в Discord з тегами PM."
            workflowFile={WORKFLOWS.floatCheck}
            inputs={{ date }}
          />
          <WorkflowCard
            title="Float Check — Test"
            description="Те саме, але в тестовий Discord канал. Без тегів PM."
            workflowFile={WORKFLOWS.floatCheck}
            inputs={{ date, no_mentions: 'true' }}
            testMode={true}
          />
        </div>
      </div>

      {/* Section: Backlog Assembly */}
      <div>
        <div className="text-sm text-[#444] tracking-widest mb-5 flex items-center gap-3">
          <span>── ASSEMBLE BACKLOG</span>
          <span className="flex-1 border-t border-[#1a1a1a]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={CODA_2D_URL}
            target="_blank"
            rel="noreferrer"
            className="border border-[#2a2a2a] p-7 hover:border-[#444] transition-colors group"
          >
            <div className="text-lg font-bold text-white tracking-wide mb-2 group-hover:text-[#ccc]">
              Assemble Backlog 2D ↗
            </div>
            <div className="text-base text-[#666]">Відкриває Coda (кнопка 2D збірки). Make.com pipeline.</div>
          </a>
          <a
            href={CODA_3D_URL}
            target="_blank"
            rel="noreferrer"
            className="border border-[#2a2a2a] p-7 hover:border-[#444] transition-colors group"
          >
            <div className="text-lg font-bold text-white tracking-wide mb-2 group-hover:text-[#ccc]">
              Assemble Backlog 3D ↗
            </div>
            <div className="text-base text-[#666]">Відкриває Coda (кнопка 3D збірки). Make.com pipeline.</div>
          </a>
        </div>
        <div className="text-xs text-[#333] mt-2 px-1">
          Coda automation via Make.com — sync with tech PM for full integration.
        </div>
      </div>

      {/* Section: Orders */}
      <div>
        <div className="text-sm text-[#444] tracking-widest mb-5 flex items-center gap-3">
          <span>── ORDER SYNC</span>
          <span className="flex-1 border-t border-[#1a1a1a]" />
        </div>
        <WorkflowCard
          title="Sync Orders"
          description="Проставляє Order в Monday відповідно до пріоритетів у Float."
          workflowFile={WORKFLOWS.orderSync}
          inputs={{ date }}
          showDryRun={true}
        />
      </div>
    </div>
  )
}
