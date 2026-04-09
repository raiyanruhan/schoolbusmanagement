import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import BusManagement from './pages/BusManagement'
import RouteManagement from './pages/RouteManagement'
import ShiftManagement from './pages/ShiftManagement'
import Planner from './pages/Planner'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="buses" element={<BusManagement />} />
        <Route path="routes" element={<RouteManagement />} />
        <Route path="shifts" element={<ShiftManagement />} />
        <Route path="planner" element={<Planner />} />
      </Route>
    </Routes>
  )
}
