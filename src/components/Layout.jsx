import { NavLink, Outlet } from 'react-router-dom'
import RobotLogo from './RobotLogo'
import { useState } from 'react'
import SettingsModal from './SettingsModal'

const navItems = [
  { to: '/', label: 'DASHBOARD' },
  { to: '/exceptions', label: 'EXCEPTIONS' },
  { to: '/guides', label: 'GUIDES' },
]

export default function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <RobotLogo size={36} />
          <span className="text-white font-bold text-sm tracking-widest select-none">
            BACKLOG-COLLECTOR-9000
          </span>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs tracking-wider border transition-colors ${
                    isActive
                      ? 'border-[#e5e5e5] text-white bg-[#1a1a1a]'
                      : 'border-transparent text-[#666] hover:text-[#aaa] hover:border-[#333]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setSettingsOpen(true)}
            className="px-3 py-1.5 text-xs tracking-wider border border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444] transition-colors"
          >
            ⚙ SETTINGS
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-8 max-w-4xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] px-6 py-3 text-center text-[#333] text-xs tracking-wider">
        BACKLOG-COLLECTOR-9000 &nbsp;·&nbsp; AndrewRSG-PM &nbsp;·&nbsp; READ FLOAT, WRITE ORDERS
      </footer>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
