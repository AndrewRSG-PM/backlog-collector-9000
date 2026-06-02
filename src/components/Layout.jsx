import { NavLink, Outlet } from 'react-router-dom'
import RobotLogo from './RobotLogo'
import { useState, useEffect } from 'react'
import SettingsModal from './SettingsModal'

const navItems = [
  { to: '/', label: 'DASHBOARD' },
  { to: '/exceptions', label: 'EXCEPTIONS' },
  { to: '/guides', label: 'GUIDES' },
]

export default function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const handler = () => setSettingsOpen(true)
    document.addEventListener('open-settings', handler)
    return () => document.removeEventListener('open-settings', handler)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <RobotLogo size={36} />
          <span className="text-white font-bold text-xl tracking-widest select-none">
            BACKLOG-COLLECTOR-9000
          </span>
          <span className="text-[#777] text-xs tracking-wider select-none">v1.0</span>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-5 py-2.5 text-base tracking-wider border transition-colors ${
                    isActive
                      ? 'border-[#e5e5e5] text-white bg-[#1a1a1a]'
                      : 'border-transparent text-[#999] hover:text-[#aaa] hover:border-[#333]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setSettingsOpen(true)}
            className="px-5 py-2.5 text-base tracking-wider border border-[#2a2a2a] text-[#999] hover:text-[#aaa] hover:border-[#444] transition-colors"
          >
            ⚙ SETTINGS
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-10 py-10 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] px-6 py-4 text-center text-[#666] text-sm tracking-wider">
        BACKLOG-COLLECTOR-9000 &nbsp;·&nbsp; AndrewRSG-PM &nbsp;·&nbsp; READ FLOAT, WRITE ORDERS
      </footer>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
