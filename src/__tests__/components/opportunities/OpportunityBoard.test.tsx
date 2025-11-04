import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OpportunityBoard } from '@/components/opportunities/OpportunityBoard'
import { createMockOpportunity } from '@/lib/test-utils'

/**
 * OpportunityBoard Component Tests
 *
 * Tests the opportunity kanban board with drag and drop functionality
 */

describe('OpportunityBoard', () => {
  const mockOpportunities = [
    createMockOpportunity({
      id: 'opp-1',
      status: 'open',
      opportunity_type: 'upsell',
      confidence_score: 90,
    }),
    createMockOpportunity({
      id: 'opp-2',
      status: 'contacted',
      opportunity_type: 'cross_sell',
      confidence_score: 75,
    }),
    createMockOpportunity({
      id: 'opp-3',
      status: 'converted',
      opportunity_type: 'renewal',
      confidence_score: 85,
    }),
    createMockOpportunity({
      id: 'opp-4',
      status: 'open',
      opportunity_type: 'win_back',
      confidence_score: 60,
    }),
  ]

  it('renders all opportunity columns', () => {
    render(<OpportunityBoard opportunities={mockOpportunities} />)

    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Contacted')).toBeInTheDocument()
    expect(screen.getByText('Converted')).toBeInTheDocument()
    expect(screen.getByText('Declined')).toBeInTheDocument()
  })

  it('displays opportunities in correct columns', () => {
    render(<OpportunityBoard opportunities={mockOpportunities} />)

    // Open column should have 2 opportunities
    const openColumn = screen.getByTestId('column-open')
    expect(openColumn).toBeInTheDocument()

    // Contacted column should have 1 opportunity
    const contactedColumn = screen.getByTestId('column-contacted')
    expect(contactedColumn).toBeInTheDocument()

    // Converted column should have 1 opportunity
    const convertedColumn = screen.getByTestId('column-converted')
    expect(convertedColumn).toBeInTheDocument()
  })

  it('displays opportunity count in each column header', () => {
    render(<OpportunityBoard opportunities={mockOpportunities} />)

    expect(screen.getByText(/Open.*2/)).toBeInTheDocument()
    expect(screen.getByText(/Contacted.*1/)).toBeInTheDocument()
    expect(screen.getByText(/Converted.*1/)).toBeInTheDocument()
    expect(screen.getByText(/Declined.*0/)).toBeInTheDocument()
  })

  it('sorts opportunities by confidence score by default', () => {
    render(<OpportunityBoard opportunities={mockOpportunities} />)

    const openColumn = screen.getByTestId('column-open')
    const cards = openColumn.querySelectorAll('[data-testid^="opportunity-card"]')

    // First card should be opp-1 (90% confidence)
    expect(cards[0]).toHaveAttribute('data-testid', 'opportunity-card-opp-1')
    // Second card should be opp-4 (60% confidence)
    expect(cards[1]).toHaveAttribute('data-testid', 'opportunity-card-opp-4')
  })

  describe('Drag and Drop', () => {
    it('allows dragging opportunities between columns', async () => {
      const mockOnStatusChange = jest.fn()
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          onStatusChange={mockOnStatusChange}
        />
      )

      const draggableCard = screen.getByTestId('opportunity-card-opp-1')
      const contactedColumn = screen.getByTestId('column-contacted')

      // Simulate drag start
      fireEvent.dragStart(draggableCard, {
        dataTransfer: {
          setData: jest.fn(),
          effectAllowed: 'move',
        },
      })

      // Simulate drop
      fireEvent.drop(contactedColumn, {
        dataTransfer: {
          getData: jest.fn(() => 'opp-1'),
        },
      })

      fireEvent.dragEnd(draggableCard)

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith('opp-1', 'contacted')
      })
    })

    it('prevents dropping on converted column', () => {
      const mockOnStatusChange = jest.fn()
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          onStatusChange={mockOnStatusChange}
        />
      )

      const draggableCard = screen.getByTestId('opportunity-card-opp-1')
      const convertedColumn = screen.getByTestId('column-converted')

      fireEvent.dragStart(draggableCard)
      fireEvent.dragOver(convertedColumn, { preventDefault: jest.fn() })

      // Should show invalid drop indicator
      expect(convertedColumn).toHaveClass('drop-invalid')
    })

    it('shows drop zone indicator when dragging over column', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} />)

      const draggableCard = screen.getByTestId('opportunity-card-opp-1')
      const contactedColumn = screen.getByTestId('column-contacted')

      fireEvent.dragStart(draggableCard)
      fireEvent.dragOver(contactedColumn, { preventDefault: jest.fn() })

      expect(contactedColumn).toHaveClass('drop-zone-active')

      fireEvent.dragLeave(contactedColumn)
      expect(contactedColumn).not.toHaveClass('drop-zone-active')
    })

    it('handles drag cancel', () => {
      const mockOnStatusChange = jest.fn()
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          onStatusChange={mockOnStatusChange}
        />
      )

      const draggableCard = screen.getByTestId('opportunity-card-opp-1')

      fireEvent.dragStart(draggableCard)
      fireEvent.dragEnd(draggableCard) // End without drop

      expect(mockOnStatusChange).not.toHaveBeenCalled()
    })
  })

  describe('Filtering', () => {
    it('filters opportunities by type', () => {
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          filters={{ type: 'upsell' }}
        />
      )

      // Should only show upsell opportunities
      expect(screen.getByTestId('opportunity-card-opp-1')).toBeInTheDocument()
      expect(screen.queryByTestId('opportunity-card-opp-2')).not.toBeInTheDocument()
    })

    it('filters opportunities by minimum confidence', () => {
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          filters={{ minConfidence: 80 }}
        />
      )

      // Should only show opportunities with >= 80% confidence
      expect(screen.getByTestId('opportunity-card-opp-1')).toBeInTheDocument() // 90%
      expect(screen.getByTestId('opportunity-card-opp-3')).toBeInTheDocument() // 85%
      expect(screen.queryByTestId('opportunity-card-opp-2')).not.toBeInTheDocument() // 75%
      expect(screen.queryByTestId('opportunity-card-opp-4')).not.toBeInTheDocument() // 60%
    })

    it('filters opportunities by search query', () => {
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          filters={{ search: 'upsell' }}
        />
      )

      expect(screen.getByTestId('opportunity-card-opp-1')).toBeInTheDocument()
      expect(screen.queryByTestId('opportunity-card-opp-2')).not.toBeInTheDocument()
    })

    it('applies multiple filters simultaneously', () => {
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          filters={{ type: 'upsell', minConfidence: 85, status: 'open' }}
        />
      )

      // Only opp-1 matches all criteria
      expect(screen.getByTestId('opportunity-card-opp-1')).toBeInTheDocument()
      expect(screen.queryByTestId('opportunity-card-opp-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('opportunity-card-opp-3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('opportunity-card-opp-4')).not.toBeInTheDocument()
    })

    it('shows empty state when no opportunities match filters', () => {
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          filters={{ search: 'nonexistent' }}
        />
      )

      expect(screen.getByText(/No opportunities found/i)).toBeInTheDocument()
    })
  })

  describe('Sorting', () => {
    it('sorts by confidence score descending', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} sortBy="confidence" />)

      const allCards = screen.getAllByTestId(/opportunity-card/)
      expect(allCards[0]).toHaveAttribute('data-testid', 'opportunity-card-opp-1') // 90%
    })

    it('sorts by estimated value descending', () => {
      const oppsWithValue = [
        createMockOpportunity({ id: 'o1', estimated_value: 100 }),
        createMockOpportunity({ id: 'o2', estimated_value: 300 }),
        createMockOpportunity({ id: 'o3', estimated_value: 200 }),
      ]

      render(<OpportunityBoard opportunities={oppsWithValue} sortBy="value" />)

      const allCards = screen.getAllByTestId(/opportunity-card/)
      expect(allCards[0]).toHaveAttribute('data-testid', 'opportunity-card-o2') // $300
    })

    it('sorts by created date descending (newest first)', () => {
      const oppsWithDates = [
        createMockOpportunity({
          id: 'o1',
          created_at: '2024-01-01T00:00:00Z',
        }),
        createMockOpportunity({
          id: 'o2',
          created_at: '2024-01-03T00:00:00Z',
        }),
        createMockOpportunity({
          id: 'o3',
          created_at: '2024-01-02T00:00:00Z',
        }),
      ]

      render(<OpportunityBoard opportunities={oppsWithDates} sortBy="date" />)

      const allCards = screen.getAllByTestId(/opportunity-card/)
      expect(allCards[0]).toHaveAttribute('data-testid', 'opportunity-card-o2') // Jan 3
    })
  })

  describe('Loading and Error States', () => {
    it('shows loading skeleton when loading', () => {
      render(<OpportunityBoard opportunities={[]} isLoading={true} />)

      expect(screen.getByTestId('board-skeleton')).toBeInTheDocument()
      expect(screen.queryByTestId('column-open')).not.toBeInTheDocument()
    })

    it('shows error message when error occurs', () => {
      render(
        <OpportunityBoard
          opportunities={[]}
          error="Failed to load opportunities"
        />
      )

      expect(screen.getByText(/Failed to load opportunities/i)).toBeInTheDocument()
    })

    it('shows retry button on error', () => {
      const mockOnRetry = jest.fn()
      render(
        <OpportunityBoard
          opportunities={[]}
          error="Failed to load"
          onRetry={mockOnRetry}
        />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalled()
    })
  })

  describe('Empty States', () => {
    it('shows empty state when no opportunities', () => {
      render(<OpportunityBoard opportunities={[]} />)

      expect(screen.getByText(/No opportunities yet/i)).toBeInTheDocument()
    })

    it('shows create opportunity button in empty state', () => {
      const mockOnCreate = jest.fn()
      render(<OpportunityBoard opportunities={[]} onCreateOpportunity={mockOnCreate} />)

      const createButton = screen.getByRole('button', { name: /create opportunity/i })
      fireEvent.click(createButton)

      expect(mockOnCreate).toHaveBeenCalled()
    })
  })

  describe('Column Statistics', () => {
    it('displays total value in column header', () => {
      const oppsWithValue = [
        createMockOpportunity({
          id: 'o1',
          status: 'open',
          estimated_value: 100,
        }),
        createMockOpportunity({
          id: 'o2',
          status: 'open',
          estimated_value: 200,
        }),
      ]

      render(<OpportunityBoard opportunities={oppsWithValue} showColumnStats={true} />)

      expect(screen.getByText(/\$300/)).toBeInTheDocument() // Total in open column
    })

    it('displays average confidence in column header', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} showColumnStats={true} />)

      // Open column has 90% and 60% = 75% average
      expect(screen.getByText(/75% avg/i)).toBeInTheDocument()
    })
  })

  describe('Bulk Actions', () => {
    it('allows selecting multiple opportunities', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} allowBulkActions={true} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument()
    })

    it('shows bulk action toolbar when opportunities selected', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} allowBulkActions={true} />)

      const checkbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(checkbox)

      expect(screen.getByTestId('bulk-actions-toolbar')).toBeInTheDocument()
    })

    it('allows bulk status change', () => {
      const mockOnBulkStatusChange = jest.fn()
      render(
        <OpportunityBoard
          opportunities={mockOpportunities}
          allowBulkActions={true}
          onBulkStatusChange={mockOnBulkStatusChange}
        />
      )

      // Select opportunities
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      // Click bulk action
      const bulkContactButton = screen.getByRole('button', {
        name: /mark as contacted/i,
      })
      fireEvent.click(bulkContactButton)

      expect(mockOnBulkStatusChange).toHaveBeenCalledWith(
        expect.arrayContaining(['opp-1', 'opp-4']),
        'contacted'
      )
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for columns', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} />)

      expect(screen.getByLabelText(/Open opportunities column/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Contacted opportunities column/i)).toBeInTheDocument()
    })

    it('announces drag and drop operations to screen readers', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} />)

      const liveRegion = screen.getByRole('status', { name: /drag announcement/i })
      expect(liveRegion).toBeInTheDocument()
    })

    it('supports keyboard navigation between columns', () => {
      render(<OpportunityBoard opportunities={mockOpportunities} />)

      const firstCard = screen.getByTestId('opportunity-card-opp-1')
      firstCard.focus()

      // Arrow right should move to next column
      fireEvent.keyDown(firstCard, { key: 'ArrowRight', code: 'ArrowRight' })

      // Focus should move to contacted column
      const contactedColumn = screen.getByTestId('column-contacted')
      expect(contactedColumn.contains(document.activeElement)).toBe(true)
    })
  })
})
