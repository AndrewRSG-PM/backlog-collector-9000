import { useState } from 'react'

const STORAGE_KEY = 'bc9000_github_pat'

export default function SettingsModal({ onClose }) {
  const [pat, setPat] = useState(localStorage.getItem(STORAGE_KEY) || '')
  const [floatToken, setFloatToken] = useState('')
  const [mondayToken, setMondayToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [patVisible, setPatVisible] = useState(false)

  function savePat() {
    if (pat.trim()) {
      localStorage.setItem(STORAGE_KEY, pat.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function updateSecret(secretName, value) {
    const storedPat = localStorage.getItem(STORAGE_KEY)
    if (!storedPat) {
      alert('GitHub PAT not set. Save PAT first.')
      return
    }
    if (!value.trim()) return

    // TODO: implement GitHub Secrets API (requires sodium encryption)
    // For now — shows instructions
    alert(
      `To update ${secretName}:\n\n1. Go to github.com/AndrewRSG-PM/backlog-collector-9000/settings/secrets/actions\n2. Edit secret "${secretName}"\n3. Paste your new value\n\nFull automation coming in Phase 5.`
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#111] border border-[#2a2a2a] w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <span className="text-xs tracking-widest text-white font-bold">⚙ SETTINGS</span>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white text-lg leading-none"
          >
            ✕
          </button>
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
                onChange={(e) => setPat(e.target.value)}
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
          <div>
            <label className="block text-xs text-[#888] tracking-wider mb-2">
              FLOAT JWT TOKEN
              <span className="text-[#555] ml-2 normal-case">(expires ~2 weeks)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={floatToken}
                onChange={(e) => setFloatToken(e.target.value)}
                placeholder="eyJ..."
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] text-[#e5e5e5] text-xs px-3 py-2 font-mono focus:outline-none focus:border-[#555] placeholder-[#444]"
              />
              <button
                onClick={() => updateSecret('FLOAT_JWT', floatToken)}
                className="px-4 py-2 border border-[#444] text-[#aaa] hover:border-[#888] hover:text-white text-xs tracking-wider transition-colors"
              >
                UPDATE
              </button>
            </div>
          </div>

          {/* Monday Token */}
          <div>
            <label className="block text-xs text-[#888] tracking-wider mb-2">
              MONDAY API TOKEN
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={mondayToken}
                onChange={(e) => setMondayToken(e.target.value)}
                placeholder="eyJ..."
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] text-[#e5e5e5] text-xs px-3 py-2 font-mono focus:outline-none focus:border-[#555] placeholder-[#444]"
              />
              <button
                onClick={() => updateSecret('MONDAY_TOKEN', mondayToken)}
                className="px-4 py-2 border border-[#444] text-[#aaa] hover:border-[#888] hover:text-white text-xs tracking-wider transition-colors"
              >
                UPDATE
              </button>
            </div>
          </div>

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
