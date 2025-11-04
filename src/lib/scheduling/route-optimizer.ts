interface Location {
  lat: number
  lng: number
  address: string
}

interface Job {
  id: string
  customer: {
    id: string
    name: string
    address: string
    lat?: number
    lng?: number
  }
  duration: number
  scheduled_time?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  time_window?: {
    start: string
    end: string
  }
}

interface Technician {
  id: string
  name: string
  start_location?: Location
  end_location?: Location
  working_hours: {
    start: string
    end: string
  }
  skills?: string[]
  max_jobs?: number
}

interface OptimizedRoute {
  technician_id: string
  jobs: Array<{
    job_id: string
    arrival_time: string
    departure_time: string
    travel_time: number
    distance: number
    sequence: number
  }>
  total_distance: number
  total_duration: number
  total_travel_time: number
  efficiency_score: number
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Radius of Earth in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(value: number): number {
  return value * Math.PI / 180
}

/**
 * Estimate travel time based on distance (assuming average speed)
 */
function estimateTravelTime(distance: number): number {
  const averageSpeed = 30 // mph in urban areas
  return Math.round((distance / averageSpeed) * 60) // minutes
}

/**
 * Calculate distance matrix between all locations
 */
function buildDistanceMatrix(locations: Location[]): number[][] {
  const n = locations.length
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distance = calculateDistance(
        locations[i].lat,
        locations[i].lng,
        locations[j].lat,
        locations[j].lng
      )
      matrix[i][j] = distance
      matrix[j][i] = distance
    }
  }

  return matrix
}

/**
 * Nearest Neighbor Algorithm for route optimization
 */
function nearestNeighborRoute(distanceMatrix: number[][], startIdx: number = 0): number[] {
  const n = distanceMatrix.length
  const visited = new Set<number>([startIdx])
  const route = [startIdx]
  let current = startIdx

  while (visited.size < n) {
    let nearest = -1
    let minDistance = Infinity

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < minDistance) {
        nearest = i
        minDistance = distanceMatrix[current][i]
      }
    }

    if (nearest !== -1) {
      visited.add(nearest)
      route.push(nearest)
      current = nearest
    } else {
      break
    }
  }

  return route
}

/**
 * 2-opt optimization to improve route
 */
function twoOptOptimization(route: number[], distanceMatrix: number[][]): number[] {
  let improved = true
  let bestRoute = [...route]
  let bestDistance = calculateRouteDistance(bestRoute, distanceMatrix)

  while (improved) {
    improved = false

    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        // Reverse segment between i and j
        const newRoute = [...bestRoute]
        reverseSegment(newRoute, i, j)

        const newDistance = calculateRouteDistance(newRoute, distanceMatrix)

        if (newDistance < bestDistance) {
          bestRoute = newRoute
          bestDistance = newDistance
          improved = true
        }
      }
    }
  }

  return bestRoute
}

function reverseSegment(route: number[], start: number, end: number): void {
  while (start < end) {
    [route[start], route[end]] = [route[end], route[start]]
    start++
    end--
  }
}

function calculateRouteDistance(route: number[], distanceMatrix: number[][]): number {
  let totalDistance = 0
  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += distanceMatrix[route[i]][route[i + 1]]
  }
  return totalDistance
}

/**
 * Main route optimization function
 */
export function optimizeRoutes(
  jobs: Job[],
  technicians: Technician[],
  date: string
): OptimizedRoute[] {
  const optimizedRoutes: OptimizedRoute[] = []

  // Group jobs by zone or proximity if needed
  const jobGroups = groupJobsByProximity(jobs)

  // Assign and optimize routes for each technician
  for (const technician of technicians) {
    const assignedJobs = assignJobsToTechnician(jobs, technician)

    if (assignedJobs.length === 0) continue

    // Build locations array including start point
    const locations: Location[] = [
      technician.start_location || { lat: 0, lng: 0, address: 'Office' },
      ...assignedJobs.map(job => ({
        lat: job.customer.lat || 0,
        lng: job.customer.lng || 0,
        address: job.customer.address
      }))
    ]

    // Calculate distance matrix
    const distanceMatrix = buildDistanceMatrix(locations)

    // Find optimal route using nearest neighbor + 2-opt
    let route = nearestNeighborRoute(distanceMatrix, 0)
    route = twoOptOptimization(route, distanceMatrix)

    // Build optimized route with timing
    const optimizedJobs = []
    let currentTime = parseTime(technician.working_hours.start)
    let totalDistance = 0
    let totalTravelTime = 0

    for (let i = 1; i < route.length; i++) {
      const jobIndex = route[i] - 1 // Adjust for start location
      const job = assignedJobs[jobIndex]
      const distance = distanceMatrix[route[i - 1]][route[i]]
      const travelTime = estimateTravelTime(distance)

      currentTime += travelTime
      totalDistance += distance
      totalTravelTime += travelTime

      optimizedJobs.push({
        job_id: job.id,
        arrival_time: formatTime(currentTime),
        departure_time: formatTime(currentTime + job.duration),
        travel_time: travelTime,
        distance: distance,
        sequence: i
      })

      currentTime += job.duration
    }

    // Calculate efficiency score
    const totalDuration = currentTime - parseTime(technician.working_hours.start)
    const workingTime = totalDuration - totalTravelTime
    const efficiencyScore = Math.round((workingTime / totalDuration) * 100)

    optimizedRoutes.push({
      technician_id: technician.id,
      jobs: optimizedJobs,
      total_distance: totalDistance,
      total_duration: totalDuration,
      total_travel_time: totalTravelTime,
      efficiency_score: efficiencyScore
    })
  }

  return optimizedRoutes
}

/**
 * Group jobs by proximity for better zone-based routing
 */
function groupJobsByProximity(jobs: Job[], maxDistance: number = 5): Job[][] {
  const groups: Job[][] = []
  const assigned = new Set<string>()

  for (const job of jobs) {
    if (assigned.has(job.id)) continue

    const group = [job]
    assigned.add(job.id)

    // Find nearby jobs
    for (const otherJob of jobs) {
      if (assigned.has(otherJob.id)) continue

      if (job.customer.lat && job.customer.lng &&
          otherJob.customer.lat && otherJob.customer.lng) {
        const distance = calculateDistance(
          job.customer.lat,
          job.customer.lng,
          otherJob.customer.lat,
          otherJob.customer.lng
        )

        if (distance <= maxDistance) {
          group.push(otherJob)
          assigned.add(otherJob.id)
        }
      }
    }

    groups.push(group)
  }

  return groups
}

/**
 * Assign jobs to technician based on capacity and skills
 */
function assignJobsToTechnician(jobs: Job[], technician: Technician): Job[] {
  // Simple assignment - can be enhanced with skill matching, capacity, etc.
  const maxJobs = technician.max_jobs || 10

  return jobs
    .filter(job => {
      // Check if job fits in technician's time window
      if (job.scheduled_time && technician.working_hours) {
        const jobTime = parseTime(job.scheduled_time)
        const startTime = parseTime(technician.working_hours.start)
        const endTime = parseTime(technician.working_hours.end)
        return jobTime >= startTime && jobTime <= endTime
      }
      return true
    })
    .slice(0, maxJobs)
}

/**
 * Parse time string to minutes since midnight
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Format minutes since midnight to time string
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Calculate savings from optimization
 */
export function calculateOptimizationSavings(
  originalRoute: number[],
  optimizedRoute: number[],
  distanceMatrix: number[][]
): { distance: number; time: number } {
  const originalDistance = calculateRouteDistance(originalRoute, distanceMatrix)
  const optimizedDistance = calculateRouteDistance(optimizedRoute, distanceMatrix)

  return {
    distance: originalDistance - optimizedDistance,
    time: estimateTravelTime(originalDistance - optimizedDistance)
  }
}

/**
 * Validate route constraints
 */
export function validateRoute(route: OptimizedRoute, technician: Technician): string[] {
  const violations: string[] = []

  // Check time window violations
  const lastJob = route.jobs[route.jobs.length - 1]
  if (lastJob) {
    const endTime = parseTime(lastJob.departure_time)
    const maxTime = parseTime(technician.working_hours.end)
    if (endTime > maxTime) {
      violations.push(`Route exceeds working hours by ${endTime - maxTime} minutes`)
    }
  }

  // Check max jobs constraint
  if (technician.max_jobs && route.jobs.length > technician.max_jobs) {
    violations.push(`Route has ${route.jobs.length} jobs, exceeds max of ${technician.max_jobs}`)
  }

  // Check efficiency
  if (route.efficiency_score < 70) {
    violations.push(`Low efficiency score: ${route.efficiency_score}%`)
  }

  return violations
}