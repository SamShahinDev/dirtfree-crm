'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Timer,
  TrendingUp
} from 'lucide-react'
import { getScheduleEfficiency } from '@/lib/analytics/technicians'

interface EfficiencyData {
  technicians: Array<{
    id: string
    name: string
    scheduledHours: number
    utilizedHours: number
    idleHours: number
    overtimeHours: number
    travelTime: number
    workTime: number
    efficiency: number
    utilizationRate: number
  }>
  summary: {
    avgEfficiency: number
    avgUtilization: number
    totalOvertime: number
    totalIdle: number
    topPerformer: string
  }
}

export function TechnicianScheduleEfficiency() {
  const [data, setData] = useState<EfficiencyData>({
    technicians: [],
    summary: {
      avgEfficiency: 0,
      avgUtilization: 0,
      totalOvertime: 0,
      totalIdle: 0,
      topPerformer: ''
    }
  })
  const [viewType, setViewType] = useState<'overview' | 'details'>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const efficiencyData = await getScheduleEfficiency()
      setData(efficiencyData)
    } catch (error) {
      console.error('Failed to load schedule efficiency:', error)
    } finally {
      setLoading(false)
    }
  }

  const pieData = [
    { name: 'Work Time', value: data.summary.avgUtilization, color: '#10b981' },
    { name: 'Travel Time', value: 15, color: '#3b82f6' },
    { name: 'Idle Time', value: 100 - data.summary.avgUtilization - 15, color: '#ef4444' }
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-gray-600">
            {payload[0].value}% of scheduled time
          </p>
        </div>
      )
    }
    return null
  }

  const RADIAN = Math.PI / 180
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Schedule Efficiency</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewType('overview')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewType === 'overview'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setViewType('details')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewType === 'details'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Details
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[350px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {viewType === 'overview' ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-green-600">
                    {data.summary.avgEfficiency}%
                  </p>
                  <p className="text-xs text-gray-600">Avg Efficiency</p>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-lg font-bold text-blue-600">
                    {data.summary.avgUtilization}%
                  </p>
                  <p className="text-xs text-gray-600">Utilization Rate</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">Productive Time</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {data.summary.avgUtilization}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm">Travel Time</span>
                  </div>
                  <span className="text-sm font-semibold">15%</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">Idle Time</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {100 - data.summary.avgUtilization - 15}%
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-xs text-gray-600">Total Overtime</span>
                  </div>
                  <p className="text-lg font-bold text-yellow-600">
                    {data.summary.totalOvertime}h
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-xs text-gray-600">Total Idle</span>
                  </div>
                  <p className="text-lg font-bold">{data.summary.totalIdle}h</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {data.technicians.slice(0, 5).map((tech) => (
                  <div
                    key={tech.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">{tech.name}</p>
                        <p className="text-sm text-gray-600">
                          {tech.scheduledHours}h scheduled
                        </p>
                      </div>
                      <Badge
                        variant={tech.efficiency >= 85 ? 'default' : 'secondary'}
                        className={
                          tech.efficiency >= 85
                            ? 'bg-green-100 text-green-700'
                            : tech.efficiency < 70
                            ? 'bg-red-100 text-red-700'
                            : ''
                        }
                      >
                        {tech.efficiency}% efficient
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-600">Work Time</span>
                          <span className="text-xs font-medium">
                            {tech.workTime}h ({tech.utilizationRate}%)
                          </span>
                        </div>
                        <Progress
                          value={tech.utilizationRate}
                          className="h-2"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center p-1 bg-gray-50 rounded">
                          <p className="text-gray-600">Travel</p>
                          <p className="font-semibold">{tech.travelTime}h</p>
                        </div>
                        <div className="text-center p-1 bg-gray-50 rounded">
                          <p className="text-gray-600">Idle</p>
                          <p className="font-semibold">{tech.idleHours}h</p>
                        </div>
                        <div className="text-center p-1 bg-gray-50 rounded">
                          <p className="text-gray-600">Overtime</p>
                          <p className="font-semibold text-yellow-600">
                            {tech.overtimeHours}h
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Top Performer
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  {data.summary.topPerformer} has the highest schedule efficiency
                  this month.
                </p>
              </div>
            </>
          )}

          {data.summary.totalIdle > 100 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    Optimization Opportunity
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    High idle time detected ({data.summary.totalIdle}h total).
                    Consider optimizing route planning and job scheduling to improve
                    utilization.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}