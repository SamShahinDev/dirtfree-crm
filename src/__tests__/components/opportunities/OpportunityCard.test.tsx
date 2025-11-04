import { render, screen, fireEvent } from '@testing-library/react'
import { OpportunityCard } from '@/components/opportunities/OpportunityCard'
import { createMockOpportunity } from '@/lib/test-utils'

/**
 * OpportunityCard Component Tests
 *
 * Tests the opportunity card component for displaying and interacting
 * with AI-generated sales opportunities
 */

describe('OpportunityCard', () => {
  const mockOpportunity = createMockOpportunity({
    id: '123',
    customer_id: 'cust-1',
    opportunity_type: 'upsell',
    service_type: 'Tile & Grout Cleaning',
    estimated_value: 250,
    confidence_score: 85,
    status: 'open',
    created_at: '2024-01-15T10:00:00Z',
  })

  it('renders opportunity details correctly', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />)

    // Check that key details are displayed
    expect(screen.getByText(/Tile & Grout Cleaning/i)).toBeInTheDocument()
    expect(screen.getByText(/\$250/)).toBeInTheDocument()
    expect(screen.getByText(/Open/i)).toBeInTheDocument()
  })

  it('displays opportunity type badge', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />)

    // Upsell should be displayed
    expect(screen.getByText(/Upsell/i)).toBeInTheDocument()
  })

  it('displays confidence score', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />)

    // Should show confidence percentage
    expect(screen.getByText(/85%/)).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', () => {
    const mockOnEdit = jest.fn()
    render(<OpportunityCard opportunity={mockOpportunity} onEdit={mockOnEdit} />)

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    expect(mockOnEdit).toHaveBeenCalledWith(mockOpportunity.id)
    expect(mockOnEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onConvert when convert button clicked', () => {
    const mockOnConvert = jest.fn()
    render(<OpportunityCard opportunity={mockOpportunity} onConvert={mockOnConvert} />)

    const convertButton = screen.getByRole('button', { name: /convert/i })
    fireEvent.click(convertButton)

    expect(mockOnConvert).toHaveBeenCalledWith(mockOpportunity.id)
    expect(mockOnConvert).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when dismiss button clicked', () => {
    const mockOnDismiss = jest.fn()
    render(<OpportunityCard opportunity={mockOpportunity} onDismiss={mockOnDismiss} />)

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    expect(mockOnDismiss).toHaveBeenCalledWith(mockOpportunity.id)
    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })

  it('shows convert option for open opportunities', () => {
    const openOpp = createMockOpportunity({ status: 'open' })
    render(<OpportunityCard opportunity={openOpp} />)

    expect(screen.getByRole('button', { name: /convert/i })).toBeInTheDocument()
  })

  it('shows contact option for open opportunities', () => {
    const openOpp = createMockOpportunity({ status: 'open' })
    render(<OpportunityCard opportunity={openOpp} />)

    expect(screen.getByRole('button', { name: /contact/i })).toBeInTheDocument()
  })

  it('does not show convert option for converted opportunities', () => {
    const convertedOpp = createMockOpportunity({ status: 'converted' })
    render(<OpportunityCard opportunity={convertedOpp} />)

    expect(screen.queryByRole('button', { name: /convert/i })).not.toBeInTheDocument()
  })

  it('does not show convert option for declined opportunities', () => {
    const declinedOpp = createMockOpportunity({ status: 'declined' })
    render(<OpportunityCard opportunity={declinedOpp} />)

    expect(screen.queryByRole('button', { name: /convert/i })).not.toBeInTheDocument()
  })

  it('shows converted badge for converted opportunities', () => {
    const convertedOpp = createMockOpportunity({ status: 'converted' })
    render(<OpportunityCard opportunity={convertedOpp} />)

    expect(screen.getByText(/Converted/i)).toBeInTheDocument()
  })

  it('applies high confidence styling for scores >= 80', () => {
    const highConfidenceOpp = createMockOpportunity({ confidence_score: 90 })
    const { container } = render(<OpportunityCard opportunity={highConfidenceOpp} />)

    // Should have high-confidence class or styling
    const scoreElement = screen.getByText(/90%/)
    expect(scoreElement).toHaveClass('high-confidence')
  })

  it('applies medium confidence styling for scores 60-79', () => {
    const mediumConfidenceOpp = createMockOpportunity({ confidence_score: 70 })
    const { container } = render(<OpportunityCard opportunity={mediumConfidenceOpp} />)

    const scoreElement = screen.getByText(/70%/)
    expect(scoreElement).toHaveClass('medium-confidence')
  })

  it('applies low confidence styling for scores < 60', () => {
    const lowConfidenceOpp = createMockOpportunity({ confidence_score: 45 })
    const { container } = render(<OpportunityCard opportunity={lowConfidenceOpp} />)

    const scoreElement = screen.getByText(/45%/)
    expect(scoreElement).toHaveClass('low-confidence')
  })

  it('displays opportunity reason if provided', () => {
    const oppWithReason = createMockOpportunity({
      reason: 'Customer has tile floors, no tile cleaning in 6 months',
    })
    render(<OpportunityCard opportunity={oppWithReason} />)

    expect(screen.getByText(/Customer has tile floors/i)).toBeInTheDocument()
  })

  it('formats estimated value as currency', () => {
    const oppWithValue = createMockOpportunity({ estimated_value: 1234.56 })
    render(<OpportunityCard opportunity={oppWithValue} />)

    // Should format as $1,234.56
    expect(screen.getByText(/\$1,234\.56/)).toBeInTheDocument()
  })

  it('displays opportunity age', () => {
    const oldOpp = createMockOpportunity({
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    })
    render(<OpportunityCard opportunity={oldOpp} />)

    expect(screen.getByText(/5 days ago/i)).toBeInTheDocument()
  })

  it('handles missing optional props gracefully', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />)

    // Should render without callbacks
    expect(screen.getByText(/Tile & Grout Cleaning/i)).toBeInTheDocument()
  })

  it('shows loading state when converting', () => {
    const { rerender } = render(
      <OpportunityCard opportunity={mockOpportunity} isConverting={false} />
    )

    expect(screen.queryByText(/Converting/i)).not.toBeInTheDocument()

    rerender(<OpportunityCard opportunity={mockOpportunity} isConverting={true} />)

    expect(screen.getByText(/Converting/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /convert/i })).toBeDisabled()
  })

  it('disables actions when loading', () => {
    render(<OpportunityCard opportunity={mockOpportunity} isLoading={true} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  describe('Opportunity Types', () => {
    it('displays upsell opportunities correctly', () => {
      const upsellOpp = createMockOpportunity({ opportunity_type: 'upsell' })
      render(<OpportunityCard opportunity={upsellOpp} />)

      expect(screen.getByText(/Upsell/i)).toBeInTheDocument()
    })

    it('displays cross-sell opportunities correctly', () => {
      const crossSellOpp = createMockOpportunity({ opportunity_type: 'cross_sell' })
      render(<OpportunityCard opportunity={crossSellOpp} />)

      expect(screen.getByText(/Cross.Sell/i)).toBeInTheDocument()
    })

    it('displays renewal opportunities correctly', () => {
      const renewalOpp = createMockOpportunity({ opportunity_type: 'renewal' })
      render(<OpportunityCard opportunity={renewalOpp} />)

      expect(screen.getByText(/Renewal/i)).toBeInTheDocument()
    })

    it('displays win-back opportunities correctly', () => {
      const winBackOpp = createMockOpportunity({ opportunity_type: 'win_back' })
      render(<OpportunityCard opportunity={winBackOpp} />)

      expect(screen.getByText(/Win.Back/i)).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('displays error message when conversion fails', () => {
      render(
        <OpportunityCard
          opportunity={mockOpportunity}
          error="Failed to convert opportunity"
        />
      )

      expect(screen.getByText(/Failed to convert opportunity/i)).toBeInTheDocument()
    })

    it('clears error when dismissed', () => {
      const mockOnClearError = jest.fn()
      render(
        <OpportunityCard
          opportunity={mockOpportunity}
          error="Failed to convert opportunity"
          onClearError={mockOnClearError}
        />
      )

      const dismissErrorButton = screen.getByRole('button', { name: /dismiss error/i })
      fireEvent.click(dismissErrorButton)

      expect(mockOnClearError).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for actions', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />)

      expect(screen.getByLabelText(/Edit opportunity/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Convert opportunity/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Dismiss opportunity/i)).toBeInTheDocument()
    })

    it('has proper heading hierarchy', () => {
      render(<OpportunityCard opportunity={mockOpportunity} />)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
    })

    it('supports keyboard navigation', () => {
      const mockOnConvert = jest.fn()
      render(<OpportunityCard opportunity={mockOpportunity} onConvert={mockOnConvert} />)

      const convertButton = screen.getByRole('button', { name: /convert/i })
      convertButton.focus()

      expect(convertButton).toHaveFocus()

      fireEvent.keyDown(convertButton, { key: 'Enter', code: 'Enter' })
      expect(mockOnConvert).toHaveBeenCalled()
    })
  })
})
