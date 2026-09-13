import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Planner from './pages/Planner'
import Settings from './pages/Settings'
import DisplayBoard from './pages/DisplayBoard'
import Incidents from './pages/Incidents'
import Toast from './components/ui/Toast'
import UpdateBanner from './components/ui/UpdateBanner'
import MandatoryUpdateModal from './components/ui/MandatoryUpdateModal'
import { useUpdateStore } from './store/updateStore'

export default function App() {
  const location = useLocation()
  const isDisplayBoard = location.pathname === '/display'
  const setUpdateStatus = useUpdateStore((s) => s.setStatus)

  useEffect(() => {
    if (isDisplayBoard) return // kiosk board — never surface update UI to riders
    window.api.update.getStatus().then(setUpdateStatus)
    return window.api.update.onEvent(setUpdateStatus)
  }, [isDisplayBoard, setUpdateStatus])

  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/:tab" element={<Settings />} />
        <Route path="/display" element={<DisplayBoard />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
      {!isDisplayBoard && (
        <>
          <UpdateBanner />
          <MandatoryUpdateModal />
        </>
      )}
    </>
  )
}
