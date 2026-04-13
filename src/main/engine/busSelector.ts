/**
 * Best-fit bus selection.
 *
 * Best-fit formula: waste = (capacity + overload_limit) - students
 * Goal: minimize waste ≥ 0.
 *
 * If no bus fits without overloading, pick the largest capacity bus as a
 * last resort (will be flagged OVERLOADED by the caller).
 */
import type { Bus } from './types'

export interface BusMatch {
  bus: Bus
  index: number
}

export function findBestFitBus(
  pool: Bus[],
  studentCount: number,
  overload_limit: number
): BusMatch | null {
  if (pool.length === 0) return null

  let bestFitIndex = -1
  let bestFitWaste = Infinity

  let fallbackIndex = -1
  let fallbackCapacity = -1

  for (let i = 0; i < pool.length; i++) {
    const bus = pool[i]
    const maxSeats = bus.capacity + overload_limit
    const waste = maxSeats - studentCount

    if (waste >= 0) {
      // Bus fits — track closest fit (min waste ≥ 0)
      if (waste < bestFitWaste) {
        bestFitWaste = waste
        bestFitIndex = i
      }
    } else {
      // Bus would be overloaded — track largest capacity as last resort
      if (bus.capacity > fallbackCapacity) {
        fallbackCapacity = bus.capacity
        fallbackIndex = i
      }
    }
  }

  if (bestFitIndex !== -1) return { bus: pool[bestFitIndex], index: bestFitIndex }
  if (fallbackIndex !== -1) return { bus: pool[fallbackIndex], index: fallbackIndex }
  return null
}

export function removeFromPool(pool: Bus[], index: number): Bus[] {
  return pool.filter((_, i) => i !== index)
}
