import { NavLink } from 'react-router-dom'

const items = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/watchlist',
    label: 'Watchlist',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
        <circle cx="18" cy="18" r="2.5" />
      </svg>
    ),
  },
  {
    to: '/positions',
    label: 'Pozice',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19V5M8 19v-7M12 19V8M16 19v-4M20 19V6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/transactions',
    label: 'Transakce',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 7h11l-2.5-2.5M17 17H6l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 17V9M18 7v8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/rules',
    label: 'Pravidla',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 6h11M8 12h11M8 18h11M5 6h.01M5 12h.01M5 18h.01" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-[#e2e8f0] bg-white shadow-[0_-4px_12px_rgba(15,23,42,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="grid h-14 grid-cols-5">
        {items.map((item) => (
          <li key={item.to} className="min-w-0">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  isActive ? 'text-[#2563eb]' : 'text-[#94a3b8]'
                }`
              }
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
