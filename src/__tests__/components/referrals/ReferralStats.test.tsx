import { render, screen, fireEvent } from '@testing-library/react'
import { ReferralStats } from '@/components/referrals/ReferralStats'
import { createMockReferral } from '@/lib/test-utils'

/**
 * ReferralStats Component Tests
 *
 * Tests the referral statistics dashboard component
 */

describe('ReferralStats', () => {
  const mockReferrals = [
    createMockReferral({
      id: 'ref-1',
      status: 'converted',
      reward_points: 100,
      converted_at: '2024-11-01T00:00:00Z',
    }),
    createMockReferral({
      id: 'ref-2',
      status: 'converted',
      reward_points: 100,
      converted_at: '2024-11-15T00:00:00Z',
    }),
    createMockReferral({
      id: 'ref-3',
      status: 'pending',
      reward_points: 0,
    }),
    createMockReferral({
      id: 'ref-4',
      status: 'active',
      reward_points: 0,
    }),
  ]

  it('displays total referrals count', () => {
    render(<ReferralStats referrals={mockReferrals} />)

    expect(screen.getByText(/Total Referrals/i)).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('displays converted referrals count', () => {
    render(<ReferralStats referrals={mockReferrals} />)

    expect(screen.getByText(/Converted/i)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('displays pending referrals count', () => {
    render(<ReferralStats referrals={mockReferrals} />)

    expect(screen.getByText(/Pending/i)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('calculates and displays conversion rate', () => {
    render(<ReferralStats referrals={mockReferrals} />)

    // 2 converted out of 4 total = 50%
    expect(screen.getByText(/Conversion Rate/i)).toBeInTheDocument()
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })

  it('displays total points earned', () => {
    render(<ReferralStats referrals={mockReferrals} />)

    expect(screen.getByText(/Points Earned/i)).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  describe('Time Period Filtering', () => {
    it('displays stats for all time by default', () => {
      render(<ReferralStats referrals={mockReferrals} />)

      expect(screen.getByText(/All Time/i)).toBeInTheDocument()
    })

    it('allows filtering by this month', () => {
      render(<ReferralStats referrals={mockReferrals} period="month" />)

      expect(screen.getByText(/This Month/i)).toBeInTheDocument()
    })

    it('allows filtering by this year', () => {
      render(<ReferralStats referrals={mockReferrals} period="year" />)

      expect(screen.getByText(/This Year/i)).toBeInTheDocument()
    })

    it('updates stats when period changes', () => {
      const { rerender } = render(
        <ReferralStats referrals={mockReferrals} period="all" />
      )

      expect(screen.getByText('4')).toBeInTheDocument() // All referrals

      rerender(<ReferralStats referrals={mockReferrals} period="month" />)

      // Would show filtered count based on current month
      expect(screen.getByTestId('total-referrals')).toBeInTheDocument()
    })

    it('calls onPeriodChange when period selector changes', () => {
      const mockOnPeriodChange = jest.fn()
      render(
        <ReferralStats referrals={mockReferrals} onPeriodChange={mockOnPeriodChange} />
      )

      const periodSelector = screen.getByRole('combobox', { name: /time period/i })
      fireEvent.change(periodSelector, { target: { value: 'month' } })

      expect(mockOnPeriodChange).toHaveBeenCalledWith('month')
    })
  })

  describe('Stat Cards', () => {
    it('renders all stat cards', () => {
      render(<ReferralStats referrals={mockReferrals} />)

      expect(screen.getByTestId('total-referrals-card')).toBeInTheDocument()
      expect(screen.getByTestId('converted-card')).toBeInTheDocument()
      expect(screen.getByTestId('pending-card')).toBeInTheDocument()
      expect(screen.getByTestId('conversion-rate-card')).toBeInTheDocument()
      expect(screen.getByTestId('points-earned-card')).toBeInTheDocument()
    })

    it('applies correct styling to stat cards', () => {
      const { container } = render(<ReferralStats referrals={mockReferrals} />)

      const cards = container.querySelectorAll('.stat-card')
      expect(cards.length).toBeGreaterThan(0)
    })

    it('shows icon for each stat', () => {
      render(<ReferralStats referrals={mockReferrals} />)

      expect(screen.getByTestId('referral-icon')).toBeInTheDocument()
      expect(screen.getByTestId('conversion-icon')).toBeInTheDocument()
      expect(screen.getByTestId('points-icon')).toBeInTheDocument()
    })
  })

  describe('Trend Indicators', () => {
    it('shows positive trend for increasing conversions', () => {
      render(<ReferralStats referrals={mockReferrals} showTrends={true} />)

      expect(screen.getByTestId('trend-up-icon')).toBeInTheDocument()
    })

    it('shows trend percentage change', () => {
      render(
        <ReferralStats
          referrals={mockReferrals}
          showTrends={true}
          previousPeriodData={{ converted: 1 }}
        />
      )

      // 2 this period vs 1 last period = +100%
      expect(screen.getByText(/\+100%/)).toBeInTheDocument()
    })

    it('shows negative trend for decreasing conversions', () => {
      render(
        <ReferralStats
          referrals={mockReferrals}
          showTrends={true}
          previousPeriodData={{ converted: 3 }}
        />
      )

      expect(screen.getByTestId('trend-down-icon')).toBeInTheDocument()
    })

    it('shows neutral indicator when no change', () => {
      render(
        <ReferralStats
          referrals={mockReferrals}
          showTrends={true}
          previousPeriodData={{ converted: 2 }}
        />
      )

      expect(screen.getByText(/0%/)).toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('shows empty state when no referrals', () => {
      render(<ReferralStats referrals={[]} />)

      expect(screen.getByText(/No referrals yet/i)).toBeInTheDocument()
    })

    it('shows zero values in stats when no referrals', () => {
      render(<ReferralStats referrals={[]} />)

      expect(screen.getByTestId('total-referrals')).toHaveTextContent('0')
      expect(screen.getByTestId('converted')).toHaveTextContent('0')
      expect(screen.getByTestId('conversion-rate')).toHaveTextContent('0%')
    })

    it('shows create referral button in empty state', () => {
      const mockOnCreate = jest.fn()
      render(<ReferralStats referrals={[]} onCreateReferral={mockOnCreate} />)

      const createButton = screen.getByRole('button', { name: /create referral/i })
      fireEvent.click(createButton)

      expect(mockOnCreate).toHaveBeenCalled()
    })
  })

  describe('Top Referrers', () => {
    it('displays top referrers section', () => {
      render(<ReferralStats referrals={mockReferrals} showTopReferrers={true} />)

      expect(screen.getByText(/Top Referrers/i)).toBeInTheDocument()
    })

    it('shows top 5 referrers by converted count', () => {
      const topReferrers = [
        { customer_name: 'John Doe', converted: 10 },
        { customer_name: 'Jane Smith', converted: 8 },
        { customer_name: 'Bob Johnson', converted: 6 },
      ]

      render(
        <ReferralStats
          referrals={mockReferrals}
          showTopReferrers={true}
          topReferrers={topReferrers}
        />
      )

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('shows leaderboard ranking', () => {
      const topReferrers = [
        { customer_name: 'John Doe', converted: 10 },
        { customer_name: 'Jane Smith', converted: 8 },
      ]

      render(
        <ReferralStats
          referrals={mockReferrals}
          showTopReferrers={true}
          topReferrers={topReferrers}
        />
      )

      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
    })
  })

  describe('Chart Visualization', () => {
    it('displays conversion trend chart', () => {
      render(<ReferralStats referrals={mockReferrals} showChart={true} />)

      expect(screen.getByTestId('conversion-trend-chart')).toBeInTheDocument()
    })

    it('allows toggling between chart and table view', () => {
      render(<ReferralStats referrals={mockReferrals} />)

      const viewToggle = screen.getByRole('button', { name: /toggle view/i })
      fireEvent.click(viewToggle)

      expect(screen.getByTestId('referral-table')).toBeInTheDocument()
    })
  })

  describe('Export Functionality', () => {
    it('shows export button', () => {
      render(<ReferralStats referrals={mockReferrals} allowExport={true} />)

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('calls onExport when export button clicked', () => {
      const mockOnExport = jest.fn()
      render(
        <ReferralStats referrals={mockReferrals} allowExport={true} onExport={mockOnExport} />
      )

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      expect(mockOnExport).toHaveBeenCalled()
    })

    it('shows export format options', () => {
      render(<ReferralStats referrals={mockReferrals} allowExport={true} />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      expect(screen.getByText(/CSV/i)).toBeInTheDocument()
      expect(screen.getByText(/Excel/i)).toBeInTheDocument()
      expect(screen.getByText(/PDF/i)).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows skeleton when loading', () => {
      render(<ReferralStats referrals={[]} isLoading={true} />)

      expect(screen.getByTestId('stats-skeleton')).toBeInTheDocument()
    })

    it('hides content when loading', () => {
      render(<ReferralStats referrals={mockReferrals} isLoading={true} />)

      expect(screen.queryByTestId('total-referrals-card')).not.toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('displays error message', () => {
      render(
        <ReferralStats referrals={[]} error="Failed to load referral stats" />
      )

      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument()
    })

    it('shows retry button on error', () => {
      const mockOnRetry = jest.fn()
      render(
        <ReferralStats referrals={[]} error="Error" onRetry={mockOnRetry} />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalled()
    })
  })

  describe('Refresh Functionality', () => {
    it('shows refresh button', () => {
      render(<ReferralStats referrals={mockReferrals} allowRefresh={true} />)

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })

    it('calls onRefresh when refresh button clicked', () => {
      const mockOnRefresh = jest.fn()
      render(
        <ReferralStats
          referrals={mockReferrals}
          allowRefresh={true}
          onRefresh={mockOnRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshButton)

      expect(mockOnRefresh).toHaveBeenCalled()
    })

    it('shows last updated timestamp', () => {
      const lastUpdated = '2024-11-20T10:00:00Z'
      render(<ReferralStats referrals={mockReferrals} lastUpdated={lastUpdated} />)

      expect(screen.getByText(/Updated/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<ReferralStats referrals={mockReferrals} />)

      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveTextContent(/Referral Statistics/i)
    })

    it('has proper ARIA labels for stats', () => {
      render(<ReferralStats referrals={mockReferrals} />)

      expect(screen.getByLabelText(/Total referrals: 4/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Converted referrals: 2/i)).toBeInTheDocument()
    })

    it('announces stats updates', () => {
      render(<ReferralStats referrals={mockReferrals} />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles division by zero for conversion rate', () => {
      render(<ReferralStats referrals={[]} />)

      expect(screen.getByTestId('conversion-rate')).toHaveTextContent('0%')
    })

    it('handles negative points gracefully', () => {
      const invalidReferrals = [
        createMockReferral({ reward_points: -100 }),
      ]
      render(<ReferralStats referrals={invalidReferrals} />)

      // Should not crash and handle gracefully
      expect(screen.getByTestId('points-earned')).toBeInTheDocument()
    })

    it('handles very large numbers', () => {
      const manyReferrals = Array.from({ length: 1000 }, (_, i) =>
        createMockReferral({ id: `ref-${i}`, status: 'converted', reward_points: 100 })
      )
      render(<ReferralStats referrals={manyReferrals} />)

      expect(screen.getByText('1,000')).toBeInTheDocument() // Total
      expect(screen.getByText('100,000')).toBeInTheDocument() // Points
    })
  })
})
