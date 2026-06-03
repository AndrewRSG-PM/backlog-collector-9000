import { useState, useEffect, useCallback } from 'react'
import { dispatchWorkflow, getLatestRun } from '../lib/github'

const CODA_2D_URL = 'https://coda.io/d/RSG-2D-Team_d6SntNSj1Co/AutoOverview-Monday_suz0ScO-#_lupvs87t'
const CODA_3D_URL = 'https://coda.io/d/RSG-3D-Team_dwKVAnig23m/AutoOverview-Monday_suOd-2bZ#_lugrhTam'

const MAKE_2D_URL = 'https://hook.eu1.make.com/0r2v6scul53iv537kxfl3fh1pht0nxh9'
const MAKE_3D_URL = 'https://hook.eu1.make.com/0cx7d1wpl2ouudadg7d61u742mqgiy6w'

const DISCORD_PROD_WEBHOOK = 'https://discord.com/api/webhooks/1507033836356374649/kHgfZvLpJNHnmJ4bAuRKmcK7Igbj7_97TwPSeGNW91GLAwRwqvUxWUYqUV3gc1O-gLfI'

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

// Convert YYYY-MM-DD → M/D/YYYY (Make.com format)
function toMakeDate(isoDate) {
  const [year, month, day] = isoDate.split('-')
  return `${parseInt(month)}/${parseInt(day)}/${year}`
}

function BacklogTriggerCard({ title, description, webhookUrl, codaUrl, date, discordMessage }) {
  const [status, setStatus] = useState(null) // null | 'sending' | 'ok' | 'error'
  const [error, setError] = useState('')

  async function trigger() {
    setStatus('sending')
    setError('')
    try {
      // Notify Discord first
      if (discordMessage) {
        await fetch(DISCORD_PROD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: discordMessage }),
        }).catch(() => {}) // non-blocking — don't fail if Discord is down
      }
      const url = `${webhookUrl}?Date=${toMakeDate(date)}&user=AndrewHolovko`
      // no-cors: Make.com receives the request, we just can't read the response body
      await fetch(url, { mode: 'no-cors' })
      setStatus('ok')
      setTimeout(() => setStatus(null), 6000)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div className="border border-[#2a2a2a] p-7 hover:border-[#333] transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-lg font-bold text-white tracking-wide mb-2">{title}</div>
          <div className="text-base text-[#999]">{description}</div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {status === 'ok'      && <span className="text-green-400 text-xs">● TRIGGERED</span>}
          {status === 'sending' && <span className="text-yellow-400 text-xs animate-pulse">● SENDING...</span>}
          <ActionButton
            label={status === 'sending' ? '...' : 'RUN'}
            onClick={trigger}
            disabled={status === 'sending'}
          />
        </div>
      </div>
      {status === 'error' && (
        <div className="text-red-400 text-xs mt-2 border border-red-900/40 px-3 py-2 bg-red-950/20">
          ✕ {error}
        </div>
      )}
      <div className="mt-2">
        <a href={codaUrl} target="_blank" rel="noreferrer"
          className="text-xs text-[#555] hover:text-[#888] underline">
          → відкрити Coda ↗
        </a>
      </div>
    </div>
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

  // Poll while running (no initial fetch — status clears on page refresh)
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
      const extraInputs = {}
      if (testMode) extraInputs.test_mode = 'true'
      if (showDryRun && dryRun) extraInputs.dry_run = 'true'
      await dispatchWorkflow(workflowFile, { ...inputs, ...extraInputs })
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
          <div className="text-base text-[#999]">{description}</div>
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
              <span className={`text-xs tracking-wider ${dryRun ? 'text-yellow-400' : 'text-[#777]'}`}>
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
        <div className="mt-2 text-[10px] text-[#777] flex items-center gap-3">
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

function NoPATBanner() {
  const [noPAT, setNoPAT] = useState(!localStorage.getItem('bc9000_github_pat'))

  useEffect(() => {
    const check = () => setNoPAT(!localStorage.getItem('bc9000_github_pat'))
    window.addEventListener('focus', check)
    document.addEventListener('pat-saved', check)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('pat-saved', check)
    }
  }, [])

  if (!noPAT) return null

  return (
    <div className="border border-orange-900/50 bg-orange-950/20 px-5 py-3 flex items-center justify-between gap-4">
      <div className="text-orange-400 text-sm">
        ⚠ GitHub PAT не встановлено — кнопки RUN і SAVE не працюватимуть.{' '}
        <a
          href="#"
          onClick={e => { e.preventDefault(); document.dispatchEvent(new CustomEvent('open-settings')) }}
          className="underline hover:text-orange-300"
        >
          Як отримати PAT →
        </a>
      </div>
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('open-settings'))}
        className="text-xs border border-orange-800 text-orange-400 hover:border-orange-500 hover:text-orange-300 px-3 py-1.5 transition-colors flex-shrink-0"
      >
        ВСТАНОВИТИ PAT
      </button>
    </div>
  )
}

function FloatFailBanner() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getLatestRun(WORKFLOWS.floatCheck).then(run => {
      if (run?.status === 'completed' && run?.conclusion === 'failure') setFailed(true)
    }).catch(() => {})
  }, [])

  if (!failed) return null

  return (
    <div className="border border-red-900/50 bg-red-950/20 px-5 py-3 flex items-center justify-between gap-4">
      <span className="text-red-400 text-sm">
        ⚠ Останній Float Check завершився з помилкою. Зверніться до Андрія або Діми для оновлення Float API Key.
      </span>
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('open-settings'))}
        className="text-xs border border-red-800 text-red-400 hover:border-red-500 hover:text-red-300 px-3 py-1.5 transition-colors flex-shrink-0"
      >
        UPDATE TOKEN
      </button>
    </div>
  )
}

export default function Dashboard() {
  const [date, setDate] = useState(todayPlus1())

  return (
    <div className="space-y-8">
      <NoPATBanner />
      <FloatFailBanner />

      {/* Date selector */}
      <div>
        <div className="text-base text-[#888] tracking-wider mb-3">TARGET DATE</div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[#0d0d0d] border border-[#2a2a2a] text-[#e5e5e5] text-base px-5 py-3 font-mono focus:outline-none focus:border-[#555]"
          />
          <button
            onClick={() => setDate(todayPlus1())}
            className="text-xs text-[#777] hover:text-[#888] underline"
          >
            reset to tomorrow
          </button>
        </div>
      </div>

      {/* Section: Float */}
      <div>
        <div className="text-sm text-[#777] tracking-widest mb-5 flex items-center gap-3">
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
        <div className="text-sm text-[#777] tracking-widest mb-5 flex items-center gap-3">
          <span>── ASSEMBLE BACKLOG</span>
          <span className="flex-1 border-t border-[#1a1a1a]" />
        </div>
        <div className="space-y-2">
          <BacklogTriggerCard
            title="Assemble Backlog 2D"
            description="Тригерить Make.com сценарій збірки беклогу для 2D художників."
            webhookUrl={MAKE_2D_URL}
            codaUrl={CODA_2D_URL}
            date={date}
            discordMessage="🤖 **ЗАПУСКАЮ 2D БЕКЛОГ**"
          />
          <BacklogTriggerCard
            title="Assemble Backlog 3D"
            description="Тригерить Make.com сценарій збірки беклогу для 3D художників."
            webhookUrl={MAKE_3D_URL}
            codaUrl={CODA_3D_URL}
            date={date}
            discordMessage="🤖 **ЗАПУСКАЮ 3D БЕКЛОГ**"
          />
        </div>
      </div>

      {/* Section: Orders */}
      <div>
        <div className="text-sm text-[#777] tracking-widest mb-5 flex items-center gap-3">
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
