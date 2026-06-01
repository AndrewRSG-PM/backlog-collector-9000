import { useState } from 'react'
import { updateGitHubSecret } from '../lib/github'

const STORAGE_KEY = 'bc9000_github_pat'

function SecretField({ label, hint, placeholder, secretName }) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null) // null | 'saving' | 'ok' | 'error'
  const [error, setError] = useState('')

  async function handleUpdate() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setError('GitHub PAT not set — save PAT first.')
      setStatus('error')
      return
    }
    if (!value.trim()) return
    setStatus('saving')
    setError('')
    try {
      await updateGitHubSecret(secretName, value.trim())
      setStatus('ok')
      setValue('')
      setTimeout(() => setStatus(null), 3000)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div>
      <label className="block text-xs text-[#888] tracking-wider mb-2">
        {label}
        {hint && <span className="text-[#555] ml-2 normal-case">{hint}</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] text-[#e5e5e5] text-xs px-3 py-2 font-mono focus:outline-none focus:border-[#555] placeholder-[#444]"
        />
        <button
          onClick={handleUpdate}
          disabled={status === 'saving' || !value.trim()}
          className="px-4 py-2 border border-[#444] text-[#aaa] hover:border-[#888] hover:text-white text-xs tracking-wider transition-colors disabled:opacity-40"
        >
          {status === 'saving' ? '...' : status === 'ok' ? '✓ UPDATED' : 'UPDATE'}
        </button>
      </div>
      {status === 'ok' && (
        <p className="text-green-400 text-xs mt-1.5">
          ✓ Secret updated in GitHub. New value takes effect on next workflow run.
        </p>
      )}
      {status === 'error' && (
        <p className="text-red-400 text-xs mt-1.5">✕ {error}</p>
      )}
    </div>
  )
}

export default function SettingsModal({ onClose }) {
  const [pat, setPat] = useState(localStorage.getItem(STORAGE_KEY) || '')
  const [saved, setSaved] = useState(false)
  const [patVisible, setPatVisible] = useState(false)

  function savePat() {
    if (pat.trim()) {
      localStorage.setItem(STORAGE_KEY, pat.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#111] border border-[#2a2a2a] w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <span className="text-xs tracking-widest text-white font-bold">⚙ SETTINGS</span>
          <button onClick={onClose} className="text-[#666] hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* GitHub PAT */}
          <div>
            <label className="block text-xs text-[#888] tracking-wider mb-2">
              GITHUB PAT
              <span className="text-[#555] ml-2 normal-case">(actions:write + contents:write + secrets:write)</span>
            </label>
            <div className="flex gap-2">
              <input
                type={patVisible ? 'text' : 'password'}
                value={pat}
                onChange={e => setPat(e.target.value)}
                placeholder="github_pat_..."
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] text-[#e5e5e5] text-xs px-3 py-2 font-mono focus:outline-none focus:border-[#555] placeholder-[#444]"
              />
              <button
                onClick={() => setPatVisible(!patVisible)}
                className="px-3 py-2 border border-[#2a2a2a] text-[#666] hover:text-[#aaa] text-xs"
              >
                {patVisible ? 'HIDE' : 'SHOW'}
              </button>
              <button
                onClick={savePat}
                className="px-4 py-2 border border-[#444] text-[#aaa] hover:border-[#888] hover:text-white text-xs tracking-wider transition-colors"
              >
                {saved ? '✓ SAVED' : 'SAVE'}
              </button>
            </div>
            <p className="text-[#444] text-xs mt-1.5">
              Stored in localStorage. Never sent to any server other than GitHub.
            </p>
          </div>

          {/* Float JWT */}
          <SecretField
            label="FLOAT JWT TOKEN"
            hint="(expires ~2 weeks — get from DevTools → Network → rsg.float.com → authorization header)"
            placeholder="eyJ..."
            secretName="FLOAT_JWT"
          />

          {/* Monday Token */}
          <SecretField
            label="MONDAY API TOKEN"
            hint="(pm.coordinator@retrostylegames.com account)"
            placeholder="eyJ..."
            secretName="MONDAY_TOKEN"
          />

          <div className="pt-2 border-t border-[#1a1a1a]">
            <a
              href="guides"
              onClick={onClose}
              className="text-xs text-[#555] hover:text-[#888] underline tracking-wider"
            >
              → HOW TO GET TOKENS (GUIDES)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
