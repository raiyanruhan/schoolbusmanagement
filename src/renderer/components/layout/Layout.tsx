import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Box } from '@primer/react'
import Sidebar from './Sidebar'
import Toast from '../ui/Toast'
import { useSessionStore } from '../../store/sessionStore'

export default function Layout() {
  const loadSession = useSessionStore((s) => s.loadSession)

  useEffect(() => {
    loadSession()
  }, [loadSession])

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Box as="main" sx={{ flex: 1, overflowY: 'auto', bg: 'canvas.default' }}>
        <Outlet />
      </Box>
      <Toast />
    </Box>
  )
}
