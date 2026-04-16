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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bgColor-default)' }}>
        <Outlet />
      </main>
      <Toast />
    </div>
  )
}
