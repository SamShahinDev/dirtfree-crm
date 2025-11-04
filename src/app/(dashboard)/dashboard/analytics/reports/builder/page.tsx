'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Plus,
  X,
  Play,
  Save,
  Download,
  Calendar,
  Database,
  Filter,
  SortAsc,
  BarChart3,
  Loader2,
  Settings,
  Trash2,
  Copy,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface DataSource {
  source_name: string
  source_label: string
  base_table: string
  description: string
  fields: Field[]
}

interface Field {
  field: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean'
  aggregatable: boolean
  filterable: boolean
  sortable: boolean
  calculated?: boolean
}

interface Column {
  field: string
  label: string
  type: string
  aggregate: string | null
}

interface Filter {
  id: string
  field: string
  operator: string
  value: any
  logic: 'AND' | 'OR'
}

interface Grouping {
  field: string
  order: number
}

interface Sorting {
  field: string
  direction: 'asc' | 'desc'
}

interface Schedule {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  time: string
  day_of_week?: number
  day_of_month?: number
  recipients: string[]
  format: 'csv' | 'json' | 'excel'
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const OPERATORS = [
  { value: '=', label: 'Equals' },
  { value: '!=', label: 'Not Equals' },
  { value: '>', label: 'Greater Than' },
  { value: '<', label: 'Less Than' },
  { value: '>=', label: 'Greater or Equal' },
  { value: '<=', label: 'Less or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'is_null', label: 'Is Null' },
  { value: 'is_not_null', label: 'Is Not Null' },
]

const AGGREGATIONS = [
  { value: 'none', label: 'None' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'count_distinct', label: 'Count Distinct' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]

export default function ReportBuilderPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [selectedDataSource, setSelectedDataSource] = useState<string>('')
  const [availableFields, setAvailableFields] = useState<Field[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Column[]>([])
  const [filters, setFilters] = useState<Filter[]>([])
  const [grouping, setGrouping] = useState<Grouping[]>([])
  const [sorting, setSorting] = useState<Sorting[]>([])
  const [visualizationType, setVisualizationType] = useState<string>('table')
  const [reportName, setReportName] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [schedule, setSchedule] = useState<Schedule>({
    enabled: false,
    frequency: 'daily',
    time: '09:00',
    recipients: [],
    format: 'csv',
  })
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [activeTab, setActiveTab] = useState('configure')

  // Load data sources on mount
  useEffect(() => {
    loadDataSources()
  }, [])

  // Update available fields when data source changes
  useEffect(() => {
    if (selectedDataSource) {
      const source = dataSources.find((ds) => ds.source_name === selectedDataSource)
      if (source) {
        setAvailableFields(source.fields)
      }
    } else {
      setAvailableFields([])
    }
  }, [selectedDataSource, dataSources])

  const loadDataSources = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/custom/data-sources')
      const data = await response.json()
      if (data.success) {
        setDataSources(data.data.data_sources)
      }
    } catch (error) {
      console.error('Failed to load data sources:', error)
    } finally {
      setLoading(false)
    }
  }

  const addColumn = (field: Field) => {
    if (!selectedColumns.find((col) => col.field === field.field)) {
      setSelectedColumns([
        ...selectedColumns,
        {
          field: field.field,
          label: field.label,
          type: field.type,
          aggregate: null,
        },
      ])
    }
  }

  const removeColumn = (field: string) => {
    setSelectedColumns(selectedColumns.filter((col) => col.field !== field))
  }

  const updateColumnAggregate = (field: string, aggregate: string) => {
    setSelectedColumns(
      selectedColumns.map((col) =>
        col.field === field
          ? { ...col, aggregate: aggregate === 'none' ? null : aggregate }
          : col
      )
    )
  }

  const addFilter = () => {
    if (availableFields.length === 0) return

    const firstFilterableField = availableFields.find((f) => f.filterable)
    if (!firstFilterableField) return

    setFilters([
      ...filters,
      {
        id: `filter-${Date.now()}`,
        field: firstFilterableField.field,
        operator: '=',
        value: '',
        logic: 'AND',
      },
    ])
  }

  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id))
  }

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  const addGrouping = (field: string) => {
    if (!grouping.find((g) => g.field === field)) {
      setGrouping([...grouping, { field, order: grouping.length + 1 }])
    }
  }

  const removeGrouping = (field: string) => {
    setGrouping(grouping.filter((g) => g.field !== field))
  }

  const addSorting = (field: string) => {
    if (!sorting.find((s) => s.field === field)) {
      setSorting([...sorting, { field, direction: 'asc' }])
    }
  }

  const removeSorting = (field: string) => {
    setSorting(sorting.filter((s) => s.field !== field))
  }

  const toggleSortDirection = (field: string) => {
    setSorting(
      sorting.map((s) =>
        s.field === field
          ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
          : s
      )
    )
  }

  const executeReport = async () => {
    if (!selectedDataSource || selectedColumns.length === 0) {
      alert('Please select a data source and at least one column')
      return
    }

    setExecuting(true)
    try {
      const response = await fetch('/api/reports/custom/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            data_source: selectedDataSource,
            columns: selectedColumns,
            filters,
            grouping,
            sorting,
          },
          limit: 100,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setResults(data.data.results || [])
        setActiveTab('results')
      } else {
        alert(`Error: ${data.message}`)
      }
    } catch (error) {
      console.error('Failed to execute report:', error)
      alert('Failed to execute report')
    } finally {
      setExecuting(false)
    }
  }

  const saveReport = async () => {
    if (!reportName || !selectedDataSource || selectedColumns.length === 0) {
      alert('Please provide report name, data source, and at least one column')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/reports/custom/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_name: reportName,
          report_description: reportDescription,
          data_source: selectedDataSource,
          columns: selectedColumns,
          filters,
          grouping,
          sorting,
          visualization_type: visualizationType,
          schedule: schedule.enabled ? schedule : null,
          is_public: isPublic,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('Report saved successfully!')
      } else {
        alert(`Error: ${data.message}`)
      }
    } catch (error) {
      console.error('Failed to save report:', error)
      alert('Failed to save report')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (format: 'csv' | 'json') => {
    if (!selectedDataSource || selectedColumns.length === 0) {
      alert('Please select a data source and at least one column')
      return
    }

    try {
      const response = await fetch('/api/reports/custom/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            data_source: selectedDataSource,
            columns: selectedColumns,
            filters,
            grouping,
            sorting,
          },
          export: format,
        }),
      })

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export report:', error)
      alert('Failed to export report')
    }
  }

  const renderVisualization = () => {
    if (results.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No data to display. Run the report to see results.
        </div>
      )
    }

    if (visualizationType === 'table') {
      return (
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                {selectedColumns.map((col) => (
                  <th key={col.field} className="px-4 py-2 text-left font-medium">
                    {col.label}
                    {col.aggregate && (
                      <Badge variant="secondary" className="ml-2">
                        {col.aggregate}
                      </Badge>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr key={idx} className="border-t">
                  {selectedColumns.map((col) => (
                    <td key={col.field} className="px-4 py-2">
                      {row[col.field] !== null && row[col.field] !== undefined
                        ? String(row[col.field])
                        : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // For charts, we need at least 2 columns (one for x-axis, one for y-axis)
    if (selectedColumns.length < 2) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Charts require at least 2 columns
        </div>
      )
    }

    const xField = selectedColumns[0].field
    const yField = selectedColumns[1].field

    if (visualizationType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={results}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xField} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={yField} fill={CHART_COLORS[0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (visualizationType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={results}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xField} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={yField} stroke={CHART_COLORS[0]} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (visualizationType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={results}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xField} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey={yField} fill={CHART_COLORS[0]} stroke={CHART_COLORS[0]} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    if (visualizationType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={results}
              dataKey={yField}
              nameKey={xField}
              cx="50%"
              cy="50%"
              outerRadius={120}
              label
            >
              {results.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Custom Report Builder</h1>
          <p className="text-muted-foreground">
            Create ad-hoc reports without developer intervention
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => executeReport()}
            disabled={executing || !selectedDataSource || selectedColumns.length === 0}
          >
            {executing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Report
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => exportReport('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={saveReport} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Save Template
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="configure">
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="results">
            <BarChart3 className="mr-2 h-4 w-4" />
            Results {results.length > 0 && `(${results.length})`}
          </TabsTrigger>
          <TabsTrigger value="save">
            <Save className="mr-2 h-4 w-4" />
            Save & Schedule
          </TabsTrigger>
        </TabsList>

        {/* Configure Tab */}
        <TabsContent value="configure" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Data Source Selection */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  Data Source
                </CardTitle>
                <CardDescription>Select the primary data source for your report</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select data source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources.map((source) => (
                      <SelectItem key={source.source_name} value={source.source_name}>
                        {source.source_label} - {source.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Column Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Available Fields</CardTitle>
                <CardDescription>Click to add fields to your report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-auto">
                  {availableFields.map((field) => (
                    <Button
                      key={field.field}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => addColumn(field)}
                      disabled={selectedColumns.some((col) => col.field === field.field)}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      {field.label}
                      <Badge variant="secondary" className="ml-auto">
                        {field.type}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected Columns */}
            <Card>
              <CardHeader>
                <CardTitle>Selected Columns</CardTitle>
                <CardDescription>Columns that will appear in your report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-auto">
                  {selectedColumns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No columns selected</p>
                  ) : (
                    selectedColumns.map((col) => {
                      const field = availableFields.find((f) => f.field === col.field)
                      return (
                        <div
                          key={col.field}
                          className="flex items-center gap-2 p-2 border rounded-md"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{col.label}</p>
                            {field?.aggregatable && (
                              <Select
                                value={col.aggregate || 'none'}
                                onValueChange={(value) => updateColumnAggregate(col.field, value)}
                              >
                                <SelectTrigger className="mt-1 h-7">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AGGREGATIONS.map((agg) => (
                                    <SelectItem key={agg.value} value={agg.value}>
                                      {agg.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeColumn(col.field)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Filters, Grouping, Sorting */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Filter className="mr-2 h-5 w-5" />
                  Filters & Options
                </CardTitle>
                <CardDescription>Configure filters, grouping, and sorting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Filters</Label>
                    <Button size="sm" variant="outline" onClick={addFilter}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-auto">
                    {filters.map((filter, index) => (
                      <div key={filter.id} className="border rounded-md p-2 space-y-2">
                        {index > 0 && (
                          <Select
                            value={filter.logic}
                            onValueChange={(value: any) =>
                              updateFilter(filter.id, { logic: value })
                            }
                          >
                            <SelectTrigger className="h-7">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Select
                          value={filter.field}
                          onValueChange={(value) => updateFilter(filter.id, { field: value })}
                        >
                          <SelectTrigger className="h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFields
                              .filter((f) => f.filterable)
                              .map((field) => (
                                <SelectItem key={field.field} value={field.field}>
                                  {field.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={filter.operator}
                          onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                        >
                          <SelectTrigger className="h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!['is_null', 'is_not_null'].includes(filter.operator) && (
                          <Input
                            placeholder="Value..."
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            className="h-7"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFilter(filter.id)}
                          className="w-full"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Grouping */}
                <div>
                  <Label className="mb-2 block">Group By</Label>
                  <Select onValueChange={addGrouping}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add grouping..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((field) => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {grouping.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {grouping.map((g) => {
                        const field = availableFields.find((f) => f.field === g.field)
                        return (
                          <div
                            key={g.field}
                            className="flex items-center justify-between p-1 border rounded"
                          >
                            <span className="text-sm">{field?.label}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeGrouping(g.field)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Sorting */}
                <div>
                  <Label className="mb-2 block">Sort By</Label>
                  <Select onValueChange={addSorting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add sorting..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields
                        .filter((f) => f.sortable)
                        .map((field) => (
                          <SelectItem key={field.field} value={field.field}>
                            {field.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {sorting.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {sorting.map((s) => {
                        const field = availableFields.find((f) => f.field === s.field)
                        return (
                          <div
                            key={s.field}
                            className="flex items-center justify-between p-1 border rounded"
                          >
                            <span className="text-sm">{field?.label}</span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSortDirection(s.field)}
                              >
                                <SortAsc
                                  className={`h-3 w-3 ${s.direction === 'desc' ? 'rotate-180' : ''}`}
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSorting(s.field)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Visualization Type */}
                <div>
                  <Label className="mb-2 block">Visualization</Label>
                  <Select value={visualizationType} onValueChange={setVisualizationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                      <SelectItem value="area">Area Chart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Report Results</CardTitle>
              <CardDescription>
                {results.length} row{results.length !== 1 ? 's' : ''} returned
              </CardDescription>
            </CardHeader>
            <CardContent>{renderVisualization()}</CardContent>
          </Card>
        </TabsContent>

        {/* Save & Schedule Tab */}
        <TabsContent value="save">
          <Card>
            <CardHeader>
              <CardTitle>Save & Schedule Report</CardTitle>
              <CardDescription>Save this report template and schedule automatic delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reportName">Report Name *</Label>
                  <Input
                    id="reportName"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="e.g., Monthly Revenue Report"
                  />
                </div>

                <div>
                  <Label htmlFor="reportDescription">Description</Label>
                  <Textarea
                    id="reportDescription"
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Describe what this report shows..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
                  <Label htmlFor="isPublic">Make this report public (visible to all staff)</Label>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="scheduleEnabled"
                      checked={schedule.enabled}
                      onCheckedChange={(checked) =>
                        setSchedule({ ...schedule, enabled: checked })
                      }
                    />
                    <Label htmlFor="scheduleEnabled">
                      <Calendar className="inline-block mr-2 h-4 w-4" />
                      Schedule automatic delivery
                    </Label>
                  </div>

                  {schedule.enabled && (
                    <div className="space-y-3 pl-6">
                      <div>
                        <Label>Frequency</Label>
                        <Select
                          value={schedule.frequency}
                          onValueChange={(value: any) =>
                            setSchedule({ ...schedule, frequency: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Time</Label>
                        <Input
                          type="time"
                          value={schedule.time}
                          onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>Export Format</Label>
                        <Select
                          value={schedule.format}
                          onValueChange={(value: any) =>
                            setSchedule({ ...schedule, format: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Recipients (comma-separated emails)</Label>
                        <Textarea
                          placeholder="email1@example.com, email2@example.com"
                          value={schedule.recipients.join(', ')}
                          onChange={(e) =>
                            setSchedule({
                              ...schedule,
                              recipients: e.target.value.split(',').map((email) => email.trim()),
                            })
                          }
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveReport} disabled={loading || !reportName}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Report
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
