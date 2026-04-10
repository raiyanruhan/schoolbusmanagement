import type { StopWithCount } from './types'

/**
 * Split an ordered list of stops into contiguous groups, each fitting within
 * (capacity + overload_limit) seats using a greedy left-to-right algorithm.
 *
 * The groups are contiguous subsets of the input array — order is preserved.
 */
export function splitIntoContiguousGroups(
  stops: StopWithCount[],
  getCount: (s: StopWithCount) => number,
  capacity: number,
  overload_limit: number
): StopWithCount[][] {
  const maxSeats = capacity + overload_limit
  const groups: StopWithCount[][] = []
  let current: StopWithCount[] = []
  let currentTotal = 0

  for (const stop of stops) {
    const count = getCount(stop)

    // If a single stop exceeds capacity on its own, it still goes into a group alone
    if (current.length > 0 && currentTotal + count > maxSeats) {
      groups.push(current)
      current = [stop]
      currentTotal = count
    } else {
      current.push(stop)
      currentTotal += count
    }
  }

  if (current.length > 0) {
    groups.push(current)
  }

  return groups
}
