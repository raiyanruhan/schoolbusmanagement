import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import Toast from '../ui/Toast'
import { useSessionStore } from '../../store/sessionStore'

export default function Layout() {
  const loadSession = useSessionStore((s) => s.loadSession)

  useEffect(() => {
    loadSession()
  }, [loadSession])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
      <Toast />
    </div>
  )
}
