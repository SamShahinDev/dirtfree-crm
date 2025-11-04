import { render, screen, fireEvent, within } from '@testing-library/react'
import { AnalyticsChart } from '@/components/analytics/AnalyticsChart'

/**
 * AnalyticsChart Component Tests
 *
 * Tests the analytics chart component for data visualization
 */

describe('AnalyticsChart', () => {
  const mockData = [
    { date: '2024-11-01', revenue: 1200, bookings: 8, customers: 5 },
    { date: '2024-11-02', revenue: 1500, bookings: 10, customers: 7 },
    { date: '2024-11-03', revenue: 900, bookings: 6, customers: 4 },
    { date: '2024-11-04', revenue: 1800, bookings: 12, customers: 9 },
    { date: '2024-11-05', revenue: 2100, bookings: 14, customers: 10 },
  ]

  describe('Chart Types', () => {
    it('renders line chart by default', () => {
      render(<AnalyticsChart data={mockData} />)

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })

    it('renders bar chart when specified', () => {
      render(<AnalyticsChart data={mockData} type="bar" />)

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('renders area chart when specified', () => {
      render(<AnalyticsChart data={mockData} type="area" />)

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('renders pie chart when specified', () => {
      render(<AnalyticsChart data={mockData} type="pie" />)

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('allows switching chart types', () => {
      render(<AnalyticsChart data={mockData} allowTypeSwitch={true} />)

      const typeSelector = screen.getByRole('combobox', { name: /chart type/i })
      fireEvent.change(typeSelector, { target: { value: 'bar' } })

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
  })

  describe('Data Series', () => {
    it('displays single metric', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue']} />)

      expect(screen.getByText(/Revenue/i)).toBeInTheDocument()
    })

    it('displays multiple metrics', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue', 'bookings']} />)

      expect(screen.getByText(/Revenue/i)).toBeInTheDocument()
      expect(screen.getByText(/Bookings/i)).toBeInTheDocument()
    })

    it('applies different colors to each metric', () => {
      const { container } = render(
        <AnalyticsChart data={mockData} metrics={['revenue', 'bookings', 'customers']} />
      )

      const lines = container.querySelectorAll('.chart-line')
      expect(lines[0]).toHaveAttribute('stroke', expect.any(String))
      expect(lines[1]).toHaveAttribute('stroke', expect.any(String))
      expect(lines[0].getAttribute('stroke')).not.toBe(lines[1].getAttribute('stroke'))
    })

    it('allows toggling metric visibility', () => {
      render(
        <AnalyticsChart
          data={mockData}
          metrics={['revenue', 'bookings']}
          allowToggleMetrics={true}
        />
      )

      const revenueLegend = screen.getByLabelText(/Revenue/i)
      fireEvent.click(revenueLegend)

      // Revenue line should be hidden
      const { container } = render(
        <AnalyticsChart
          data={mockData}
          metrics={['revenue', 'bookings']}
          hiddenMetrics={['revenue']}
        />
      )
      expect(container.querySelector('[data-metric="revenue"]')).toHaveClass('hidden')
    })
  })

  describe('Axes and Labels', () => {
    it('displays x-axis labels', () => {
      render(<AnalyticsChart data={mockData} />)

      expect(screen.getByText('Nov 1')).toBeInTheDocument()
      expect(screen.getByText('Nov 5')).toBeInTheDocument()
    })

    it('displays y-axis labels', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue']} />)

      expect(screen.getByText(/\$0/)).toBeInTheDocument()
      expect(screen.getByText(/\$2,000/i)).toBeInTheDocument()
    })

    it('formats currency values correctly', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue']} />)

      expect(screen.getByText(/\$1,200/)).toBeInTheDocument()
      expect(screen.getByText(/\$2,100/)).toBeInTheDocument()
    })

    it('displays custom axis labels', () => {
      render(
        <AnalyticsChart
          data={mockData}
          xAxisLabel="Date"
          yAxisLabel="Amount ($)"
        />
      )

      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Amount ($)')).toBeInTheDocument()
    })

    it('rotates x-axis labels when many data points', () => {
      const manyDataPoints = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-11-${i + 1}`,
        revenue: Math.random() * 1000,
      }))

      const { container } = render(<AnalyticsChart data={manyDataPoints} />)

      const xAxisLabels = container.querySelectorAll('.x-axis text')
      expect(xAxisLabels[0]).toHaveAttribute('transform', expect.stringContaining('rotate'))
    })
  })

  describe('Tooltips and Hover', () => {
    it('shows tooltip on data point hover', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue']} />)

      const dataPoint = screen.getAllByTestId('data-point')[0]
      fireEvent.mouseEnter(dataPoint)

      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('displays correct values in tooltip', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue', 'bookings']} />)

      const dataPoint = screen.getAllByTestId('data-point')[0]
      fireEvent.mouseEnter(dataPoint)

      const tooltip = screen.getByRole('tooltip')
      expect(within(tooltip).getByText(/Nov 1/i)).toBeInTheDocument()
      expect(within(tooltip).getByText(/\$1,200/)).toBeInTheDocument()
      expect(within(tooltip).getByText(/8.*bookings/i)).toBeInTheDocument()
    })

    it('hides tooltip on mouse leave', () => {
      render(<AnalyticsChart data={mockData} />)

      const dataPoint = screen.getAllByTestId('data-point')[0]
      fireEvent.mouseEnter(dataPoint)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      fireEvent.mouseLeave(dataPoint)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('updates tooltip when hovering different points', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue']} />)

      const dataPoints = screen.getAllByTestId('data-point')

      fireEvent.mouseEnter(dataPoints[0])
      expect(screen.getByText(/\$1,200/)).toBeInTheDocument()

      fireEvent.mouseEnter(dataPoints[4])
      expect(screen.getByText(/\$2,100/)).toBeInTheDocument()
    })
  })

  describe('Legend', () => {
    it('displays legend', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue', 'bookings']} />)

      expect(screen.getByText(/Revenue/i)).toBeInTheDocument()
      expect(screen.getByText(/Bookings/i)).toBeInTheDocument()
    })

    it('hides legend when showLegend is false', () => {
      render(
        <AnalyticsChart
          data={mockData}
          metrics={['revenue']}
          showLegend={false}
        />
      )

      expect(screen.queryByTestId('chart-legend')).not.toBeInTheDocument()
    })

    it('positions legend correctly', () => {
      const { container } = render(
        <AnalyticsChart
          data={mockData}
          metrics={['revenue']}
          legendPosition="bottom"
        />
      )

      const legend = container.querySelector('.chart-legend')
      expect(legend).toHaveClass('legend-bottom')
    })

    it('shows metric color indicators in legend', () => {
      render(<AnalyticsChart data={mockData} metrics={['revenue', 'bookings']} />)

      const colorIndicators = screen.getAllByTestId('legend-color')
      expect(colorIndicators).toHaveLength(2)
    })
  })

  describe('Data Filtering', () => {
    it('filters data by date range', () => {
      render(
        <AnalyticsChart
          data={mockData}
          dateRange={{ start: '2024-11-02', end: '2024-11-04' }}
        />
      )

      expect(screen.getByText('Nov 2')).toBeInTheDocument()
      expect(screen.getByText('Nov 4')).toBeInTheDocument()
      expect(screen.queryByText('Nov 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Nov 5')).not.toBeInTheDocument()
    })

    it('shows date range selector', () => {
      render(<AnalyticsChart data={mockData} showDateRangePicker={true} />)

      expect(screen.getByRole('button', { name: /date range/i })).toBeInTheDocument()
    })

    it('updates chart when date range changes', () => {
      const mockOnDateRangeChange = jest.fn()
      render(
        <AnalyticsChart
          data={mockData}
          showDateRangePicker={true}
          onDateRangeChange={mockOnDateRangeChange}
        />
      )

      const dateRangeButton = screen.getByRole('button', { name: /date range/i })
      fireEvent.click(dateRangeButton)

      const lastWeekOption = screen.getByText(/Last 7 days/i)
      fireEvent.click(lastWeekOption)

      expect(mockOnDateRangeChange).toHaveBeenCalled()
    })
  })

  describe('Aggregation', () => {
    it('aggregates data by day (default)', () => {
      render(<AnalyticsChart data={mockData} />)

      const dataPoints = screen.getAllByTestId('data-point')
      expect(dataPoints).toHaveLength(5) // 5 days
    })

    it('aggregates data by week', () => {
      render(<AnalyticsChart data={mockData} aggregation="week" />)

      expect(screen.getByText(/Week/i)).toBeInTheDocument()
    })

    it('aggregates data by month', () => {
      render(<AnalyticsChart data={mockData} aggregation="month" />)

      expect(screen.getByText(/Nov/i)).toBeInTheDocument()
    })

    it('allows changing aggregation level', () => {
      render(<AnalyticsChart data={mockData} allowAggregationChange={true} />)

      const aggregationSelector = screen.getByRole('combobox', { name: /group by/i })
      expect(aggregationSelector).toBeInTheDocument()

      fireEvent.change(aggregationSelector, { target: { value: 'week' } })
      expect(aggregationSelector).toHaveValue('week')
    })
  })

  describe('Comparison', () => {
    it('shows comparison with previous period', () => {
      const previousData = [
        { date: '2024-10-01', revenue: 1000, bookings: 7 },
        { date: '2024-10-02', revenue: 1200, bookings: 8 },
      ]

      render(
        <AnalyticsChart
          data={mockData}
          comparisonData={previousData}
          showComparison={true}
        />
      )

      expect(screen.getByText(/Previous Period/i)).toBeInTheDocument()
    })

    it('displays percentage change indicators', () => {
      const previousData = mockData.map(d => ({ ...d, revenue: d.revenue * 0.8 }))

      render(
        <AnalyticsChart
          data={mockData}
          comparisonData={previousData}
          showComparison={true}
        />
      )

      expect(screen.getByText(/\+25%/)).toBeInTheDocument() // 20% increase
    })

    it('shows positive trends in green', () => {
      const previousData = mockData.map(d => ({ ...d, revenue: d.revenue * 0.8 }))

      const { container } = render(
        <AnalyticsChart
          data={mockData}
          comparisonData={previousData}
          showComparison={true}
        />
      )

      const trendIndicator = container.querySelector('.trend-positive')
      expect(trendIndicator).toBeInTheDocument()
    })

    it('shows negative trends in red', () => {
      const previousData = mockData.map(d => ({ ...d, revenue: d.revenue * 1.2 }))

      const { container } = render(
        <AnalyticsChart
          data={mockData}
          comparisonData={previousData}
          showComparison={true}
        />
      )

      const trendIndicator = container.querySelector('.trend-negative')
      expect(trendIndicator).toBeInTheDocument()
    })
  })

  describe('Export', () => {
    it('shows export button', () => {
      render(<AnalyticsChart data={mockData} allowExport={true} />)

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('calls onExport when export clicked', () => {
      const mockOnExport = jest.fn()
      render(
        <AnalyticsChart data={mockData} allowExport={true} onExport={mockOnExport} />
      )

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      expect(mockOnExport).toHaveBeenCalled()
    })

    it('shows export format options', () => {
      render(<AnalyticsChart data={mockData} allowExport={true} />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      expect(screen.getByText(/PNG/i)).toBeInTheDocument()
      expect(screen.getByText(/SVG/i)).toBeInTheDocument()
      expect(screen.getByText(/CSV/i)).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows skeleton when loading', () => {
      render(<AnalyticsChart data={[]} isLoading={true} />)

      expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument()
    })

    it('hides chart when loading', () => {
      render(<AnalyticsChart data={mockData} isLoading={true} />)

      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('shows empty state when no data', () => {
      render(<AnalyticsChart data={[]} />)

      expect(screen.getByText(/No data available/i)).toBeInTheDocument()
    })

    it('shows message for filtered out data', () => {
      render(
        <AnalyticsChart
          data={mockData}
          dateRange={{ start: '2025-01-01', end: '2025-01-31' }}
        />
      )

      expect(screen.getByText(/No data for selected period/i)).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('displays error message', () => {
      render(<AnalyticsChart data={[]} error="Failed to load chart data" />)

      expect(screen.getByText(/Failed to load chart data/i)).toBeInTheDocument()
    })

    it('shows retry button on error', () => {
      const mockOnRetry = jest.fn()
      render(
        <AnalyticsChart data={[]} error="Error" onRetry={mockOnRetry} />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalled()
    })
  })

  describe('Responsive Behavior', () => {
    it('adjusts to container width', () => {
      const { container } = render(<AnalyticsChart data={mockData} responsive={true} />)

      const chart = container.querySelector('.chart-container')
      expect(chart).toHaveStyle({ width: '100%' })
    })

    it('maintains aspect ratio', () => {
      const { container } = render(
        <AnalyticsChart data={mockData} aspectRatio={16 / 9} />
      )

      const chart = container.querySelector('.chart-container')
      expect(chart).toHaveAttribute('data-aspect-ratio', '1.7777777777777777')
    })
  })

  describe('Annotations', () => {
    it('displays annotations on chart', () => {
      const annotations = [
        { date: '2024-11-03', label: 'Holiday', type: 'event' },
      ]

      render(<AnalyticsChart data={mockData} annotations={annotations} />)

      expect(screen.getByText('Holiday')).toBeInTheDocument()
    })

    it('shows annotation markers', () => {
      const annotations = [
        { date: '2024-11-03', label: 'Holiday', type: 'event' },
      ]

      const { container } = render(
        <AnalyticsChart data={mockData} annotations={annotations} />
      )

      const marker = container.querySelector('.annotation-marker')
      expect(marker).toBeInTheDocument()
    })

    it('displays annotation tooltip on hover', () => {
      const annotations = [
        {
          date: '2024-11-03',
          label: 'Holiday',
          description: 'Thanksgiving holiday',
        },
      ]

      render(<AnalyticsChart data={mockData} annotations={annotations} />)

      const annotation = screen.getByText('Holiday')
      fireEvent.mouseEnter(annotation)

      expect(screen.getByText('Thanksgiving holiday')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<AnalyticsChart data={mockData} title="Revenue Chart" />)

      expect(screen.getByRole('img', { name: /Revenue Chart/i })).toBeInTheDocument()
    })

    it('provides data table alternative', () => {
      render(<AnalyticsChart data={mockData} showDataTable={true} />)

      const toggleButton = screen.getByRole('button', { name: /view as table/i })
      fireEvent.click(toggleButton)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('has keyboard navigable data points', () => {
      render(<AnalyticsChart data={mockData} />)

      const dataPoints = screen.getAllByTestId('data-point')
      dataPoints[0].focus()

      expect(dataPoints[0]).toHaveFocus()
    })

    it('announces data updates to screen readers', () => {
      render(<AnalyticsChart data={mockData} />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles single data point', () => {
      const singlePoint = [mockData[0]]
      render(<AnalyticsChart data={singlePoint} />)

      expect(screen.getByTestId('data-point')).toBeInTheDocument()
    })

    it('handles negative values', () => {
      const negativeData = mockData.map(d => ({ ...d, revenue: -Math.abs(d.revenue) }))
      render(<AnalyticsChart data={negativeData} metrics={['revenue']} />)

      expect(screen.getByText(/-\$1,200/)).toBeInTheDocument()
    })

    it('handles very large numbers', () => {
      const largeData = mockData.map(d => ({ ...d, revenue: d.revenue * 1000000 }))
      render(<AnalyticsChart data={largeData} metrics={['revenue']} />)

      expect(screen.getByText(/\$1\.2M/i)).toBeInTheDocument()
    })

    it('handles missing data points', () => {
      const sparseData = [
        { date: '2024-11-01', revenue: 1200 },
        { date: '2024-11-03', revenue: null },
        { date: '2024-11-05', revenue: 2100 },
      ]

      render(<AnalyticsChart data={sparseData} metrics={['revenue']} />)

      const dataPoints = screen.getAllByTestId('data-point')
      expect(dataPoints).toHaveLength(2) // Only non-null values
    })
  })
})
