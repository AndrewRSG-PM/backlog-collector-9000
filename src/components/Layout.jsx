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
      <header className="border-b border-[#2b3a5e] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <RobotLogo size={36} />
          <span className="text-white font-bold text-xl tracking-widest select-none">
            BACKLOG-COLLECTOR-9000
          </span>
          <span className="text-[#6f81ab] text-xs tracking-wider select-none">v1.4</span>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-5 py-2.5 text-base tracking-wider rounded-lg border transition-colors ${
                    isActive
                      ? 'border-[#3b4f7c] text-white bg-[#1d2740]'
                      : 'border-transparent text-[#93a2c2] hover:text-[#c9d3e6] hover:bg-[#151d30]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setSettingsOpen(true)}
            className="px-5 py-2.5 text-base tracking-wider rounded-lg border border-[#2b3a5e] text-[#93a2c2] hover:text-[#c9d3e6] hover:border-[#44598c] transition-colors"
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
      <footer className="border-t border-[#1a2336] px-6 py-4 text-center text-[#6173a0] text-sm tracking-wider">
        BACKLOG-COLLECTOR-9000 &nbsp;·&nbsp; AndrewRSG-PM &nbsp;·&nbsp; READ FLOAT, WRITE ORDERS
      </footer>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
