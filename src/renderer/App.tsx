import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Planner from './pages/Planner'
import Settings from './pages/Settings'
import DisplayBoard from './pages/DisplayBoard'
import Incidents from './pages/Incidents'
import Toast from './components/ui/Toast'

export default function App() {
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
    </>
  )
}
