import { sessionRepo } from '../repositories/sessionRepo'
import type { Session, DashboardStats, IpcResult } from '../../shared/types'
import { busRepo } from '../repositories/busRepo'
import { routeRepo } from '../repositories/routeRepo'
import { shiftRepo } from '../repositories/shiftRepo'
import { runRepo } from '../repositories/runRepo'

export const sessionService = {
  getOrCreateToday(): IpcResult<Session> {
    try {
      const session = sessionRepo.getOrCreateToday()
      return { success: true, data: session }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  getDashboardStats(): IpcResult<DashboardStats> {
    try {
      const session = sessionRepo.getOrCreateToday()

      const allBuses = busRepo.getAll()
      const activeBuses = allBuses.filter((b) => b.status === 'ACTIVE').length
      const allRoutes = routeRepo.getAllRoutes()
      const activeRoutes = allRoutes.filter((r) => r.is_active)

      // Total students = sum of planned_boys + planned_girls across all active stop configs
      let totalStudents = 0
      const shifts = shiftRepo.getAll()
      for (const shift of shifts) {
        if (!shift.is_active) continue
        const configs = shiftRepo.getStopConfigsByShift(shift.id)
        for (const cfg of configs) {
          if (cfg.is_active) {
            totalStudents += cfg.planned_boys + cfg.planned_girls
          }
        }
      }

      // De-duplicate: count unique students (planned total across all active shifts)
      // For simplicity, take the max across shifts (each student belongs to 1 shift)
      // Actually just sum — operator configures per-shift

      const runs = runRepo.getRunsBySession(session.id)

      return {
        success: true,
        data: {
          session,
          totalBuses: allBuses.length,
          activeBuses,
          totalRoutes: activeRoutes.length,
          totalStudents,
          runsToday: runs.length
        }
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
