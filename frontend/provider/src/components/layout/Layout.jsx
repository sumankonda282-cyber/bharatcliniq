import { useState } from 'react'
import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import BrandLogo from '../BrandLogo'

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F4F8' }}>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Mobile sidebar (drawer) */}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <main className="flex-1 md:ml-60 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <BrandLogo size="sm" />
        </div>
        <div className="p-4 md:p-6 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
