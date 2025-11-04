import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PromotionCard } from '@/components/promotions/PromotionCard'
import { createMockPromotion } from '@/lib/test-utils'

/**
 * PromotionCard Component Tests
 *
 * Tests the promotion card component for displaying and managing promotions
 */

describe('PromotionCard', () => {
  const mockPromotion = createMockPromotion({
    id: 'promo-1',
    code: 'SAVE20',
    description: '20% off carpet cleaning',
    discount_type: 'percentage',
    discount_value: 20,
    valid_from: '2024-01-01T00:00:00Z',
    valid_until: '2024-12-31T23:59:59Z',
    active: true,
    max_uses: 100,
    current_uses: 25,
  })

  it('renders promotion details correctly', () => {
    render(<PromotionCard promotion={mockPromotion} />)

    expect(screen.getByText('SAVE20')).toBeInTheDocument()
    expect(screen.getByText('20% off carpet cleaning')).toBeInTheDocument()
    expect(screen.getByText(/20%/)).toBeInTheDocument()
  })

  it('displays promotion code prominently', () => {
    render(<PromotionCard promotion={mockPromotion} />)

    const codeElement = screen.getByText('SAVE20')
    expect(codeElement).toHaveClass('promotion-code')
  })

  it('shows active status badge', () => {
    render(<PromotionCard promotion={mockPromotion} />)

    expect(screen.getByText(/Active/i)).toBeInTheDocument()
  })

  it('shows inactive status badge for inactive promotions', () => {
    const inactivePromo = createMockPromotion({ active: false })
    render(<PromotionCard promotion={inactivePromo} />)

    expect(screen.getByText(/Inactive/i)).toBeInTheDocument()
  })

  it('displays usage statistics', () => {
    render(<PromotionCard promotion={mockPromotion} />)

    expect(screen.getByText(/25 \/ 100 uses/i)).toBeInTheDocument()
  })

  it('displays usage percentage progress bar', () => {
    render(<PromotionCard promotion={mockPromotion} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '25')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })

  it('displays validity period', () => {
    render(<PromotionCard promotion={mockPromotion} />)

    expect(screen.getByText(/Valid/i)).toBeInTheDocument()
    expect(screen.getByText(/Jan 1, 2024/i)).toBeInTheDocument()
    expect(screen.getByText(/Dec 31, 2024/i)).toBeInTheDocument()
  })

  describe('Discount Types', () => {
    it('displays percentage discount correctly', () => {
      const percentagePromo = createMockPromotion({
        discount_type: 'percentage',
        discount_value: 15,
      })
      render(<PromotionCard promotion={percentagePromo} />)

      expect(screen.getByText(/15% off/i)).toBeInTheDocument()
    })

    it('displays fixed amount discount correctly', () => {
      const fixedPromo = createMockPromotion({
        discount_type: 'fixed_amount',
        discount_value: 50,
      })
      render(<PromotionCard promotion={fixedPromo} />)

      expect(screen.getByText(/\$50 off/i)).toBeInTheDocument()
    })

    it('displays free service discount correctly', () => {
      const freeServicePromo = createMockPromotion({
        discount_type: 'free_service',
        discount_value: 0,
        description: 'Free room with 3+ rooms',
      })
      render(<PromotionCard promotion={freeServicePromo} />)

      expect(screen.getByText(/Free/i)).toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    it('calls onEdit when edit button clicked', () => {
      const mockOnEdit = jest.fn()
      render(<PromotionCard promotion={mockPromotion} onEdit={mockOnEdit} />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      expect(mockOnEdit).toHaveBeenCalledWith(mockPromotion.id)
    })

    it('calls onToggleActive when toggle switch clicked', () => {
      const mockOnToggleActive = jest.fn()
      render(<PromotionCard promotion={mockPromotion} onToggleActive={mockOnToggleActive} />)

      const toggleSwitch = screen.getByRole('switch', { name: /active/i })
      fireEvent.click(toggleSwitch)

      expect(mockOnToggleActive).toHaveBeenCalledWith(mockPromotion.id, false)
    })

    it('calls onCopy when copy code button clicked', () => {
      const mockOnCopy = jest.fn()
      render(<PromotionCard promotion={mockPromotion} onCopyCode={mockOnCopy} />)

      const copyButton = screen.getByRole('button', { name: /copy code/i })
      fireEvent.click(copyButton)

      expect(mockOnCopy).toHaveBeenCalledWith('SAVE20')
    })

    it('shows copy confirmation after copying', async () => {
      render(<PromotionCard promotion={mockPromotion} />)

      const copyButton = screen.getByRole('button', { name: /copy code/i })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(screen.getByText(/Copied!/i)).toBeInTheDocument()
      })

      // Confirmation should disappear after delay
      await waitFor(
        () => {
          expect(screen.queryByText(/Copied!/i)).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    it('calls onDelete when delete button clicked', () => {
      const mockOnDelete = jest.fn()
      render(<PromotionCard promotion={mockPromotion} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      expect(mockOnDelete).toHaveBeenCalledWith(mockPromotion.id)
    })

    it('shows confirmation dialog before deleting', () => {
      const mockOnDelete = jest.fn()
      render(<PromotionCard promotion={mockPromotion} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      // Confirmation dialog should appear
      expect(screen.getByText(/Are you sure/i)).toBeInTheDocument()

      // Cancel should not delete
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)
      expect(mockOnDelete).not.toHaveBeenCalled()
    })
  })

  describe('Status Indicators', () => {
    it('shows expiring soon warning', () => {
      const expiringSoon = createMockPromotion({
        valid_until: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
      })
      render(<PromotionCard promotion={expiringSoon} />)

      expect(screen.getByText(/Expiring in 5 days/i)).toBeInTheDocument()
      expect(screen.getByTestId('expiring-warning')).toHaveClass('warning')
    })

    it('shows expired badge for past promotions', () => {
      const expiredPromo = createMockPromotion({
        valid_until: '2023-01-01T00:00:00Z', // Past date
      })
      render(<PromotionCard promotion={expiredPromo} />)

      expect(screen.getByText(/Expired/i)).toBeInTheDocument()
    })

    it('shows fully used badge when max uses reached', () => {
      const fullyUsedPromo = createMockPromotion({
        max_uses: 100,
        current_uses: 100,
      })
      render(<PromotionCard promotion={fullyUsedPromo} />)

      expect(screen.getByText(/Fully Used/i)).toBeInTheDocument()
    })

    it('shows warning when usage is above 80%', () => {
      const nearlyFullPromo = createMockPromotion({
        max_uses: 100,
        current_uses: 85,
      })
      render(<PromotionCard promotion={nearlyFullPromo} />)

      expect(screen.getByTestId('usage-warning')).toBeInTheDocument()
    })

    it('shows scheduled badge for future promotions', () => {
      const futurePromo = createMockPromotion({
        valid_from: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days future
      })
      render(<PromotionCard promotion={futurePromo} />)

      expect(screen.getByText(/Scheduled/i)).toBeInTheDocument()
      expect(screen.getByText(/Starts in 10 days/i)).toBeInTheDocument()
    })
  })

  describe('Targeting Information', () => {
    it('displays target customer segments', () => {
      const targetedPromo = createMockPromotion({
        target_segments: ['new_customers', 'inactive_customers'],
      })
      render(<PromotionCard promotion={targetedPromo} showTargeting={true} />)

      expect(screen.getByText(/New Customers/i)).toBeInTheDocument()
      expect(screen.getByText(/Inactive Customers/i)).toBeInTheDocument()
    })

    it('displays service type restrictions', () => {
      const servicePromo = createMockPromotion({
        applicable_services: ['Carpet Cleaning', 'Tile & Grout'],
      })
      render(<PromotionCard promotion={servicePromo} showTargeting={true} />)

      expect(screen.getByText(/Carpet Cleaning/i)).toBeInTheDocument()
      expect(screen.getByText(/Tile & Grout/i)).toBeInTheDocument()
    })

    it('shows geographic restrictions', () => {
      const geoPromo = createMockPromotion({
        target_zip_codes: ['90210', '90211'],
      })
      render(<PromotionCard promotion={geoPromo} showTargeting={true} />)

      expect(screen.getByText(/90210/i)).toBeInTheDocument()
      expect(screen.getByText(/90211/i)).toBeInTheDocument()
    })

    it('shows minimum purchase requirement', () => {
      const minPurchasePromo = createMockPromotion({
        min_purchase: 200,
      })
      render(<PromotionCard promotion={minPurchasePromo} />)

      expect(screen.getByText(/Min\. \$200/i)).toBeInTheDocument()
    })
  })

  describe('Performance Stats', () => {
    it('displays conversion rate', () => {
      render(<PromotionCard promotion={mockPromotion} showStats={true} />)

      // Assuming stats are passed or calculated
      expect(screen.getByText(/Conversion Rate/i)).toBeInTheDocument()
    })

    it('displays total revenue generated', () => {
      const promoWithStats = {
        ...mockPromotion,
        total_revenue: 5000,
      }
      render(<PromotionCard promotion={promoWithStats} showStats={true} />)

      expect(screen.getByText(/\$5,000/i)).toBeInTheDocument()
    })

    it('displays average order value', () => {
      const promoWithStats = {
        ...mockPromotion,
        avg_order_value: 250,
      }
      render(<PromotionCard promotion={promoWithStats} showStats={true} />)

      expect(screen.getByText(/\$250/i)).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('disables actions when loading', () => {
      render(<PromotionCard promotion={mockPromotion} isLoading={true} />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      const toggleSwitch = screen.getByRole('switch', { name: /active/i })

      expect(editButton).toBeDisabled()
      expect(toggleSwitch).toBeDisabled()
    })

    it('shows loading spinner when toggling active status', () => {
      render(<PromotionCard promotion={mockPromotion} isToggling={true} />)

      expect(screen.getByTestId('toggle-spinner')).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('displays error message', () => {
      render(
        <PromotionCard promotion={mockPromotion} error="Failed to update promotion" />
      )

      expect(screen.getByText(/Failed to update promotion/i)).toBeInTheDocument()
    })

    it('allows dismissing error', () => {
      const mockOnClearError = jest.fn()
      render(
        <PromotionCard
          promotion={mockPromotion}
          error="Error occurred"
          onClearError={mockOnClearError}
        />
      )

      const dismissButton = screen.getByRole('button', { name: /dismiss error/i })
      fireEvent.click(dismissButton)

      expect(mockOnClearError).toHaveBeenCalled()
    })
  })

  describe('Compact Mode', () => {
    it('renders in compact mode', () => {
      const { container } = render(
        <PromotionCard promotion={mockPromotion} compact={true} />
      )

      expect(container.firstChild).toHaveClass('promotion-card-compact')
    })

    it('hides detailed stats in compact mode', () => {
      render(<PromotionCard promotion={mockPromotion} compact={true} showStats={true} />)

      expect(screen.queryByText(/Conversion Rate/i)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<PromotionCard promotion={mockPromotion} />)

      expect(screen.getByLabelText(/Edit promotion/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Delete promotion/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Toggle active status/i)).toBeInTheDocument()
    })

    it('has proper heading hierarchy', () => {
      render(<PromotionCard promotion={mockPromotion} />)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('SAVE20')
    })

    it('supports keyboard navigation', () => {
      const mockOnEdit = jest.fn()
      render(<PromotionCard promotion={mockPromotion} onEdit={mockOnEdit} />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      editButton.focus()

      expect(editButton).toHaveFocus()

      fireEvent.keyDown(editButton, { key: 'Enter' })
      expect(mockOnEdit).toHaveBeenCalled()
    })

    it('announces status changes to screen readers', async () => {
      render(<PromotionCard promotion={mockPromotion} />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles unlimited max uses', () => {
      const unlimitedPromo = createMockPromotion({
        max_uses: null,
        current_uses: 50,
      })
      render(<PromotionCard promotion={unlimitedPromo} />)

      expect(screen.getByText(/50 uses/i)).toBeInTheDocument()
      expect(screen.getByText(/Unlimited/i)).toBeInTheDocument()
    })

    it('handles very long promotion codes', () => {
      const longCodePromo = createMockPromotion({
        code: 'VERYLONGPROMOTIONCODE2024SPECIAL',
      })
      const { container } = render(<PromotionCard promotion={longCodePromo} />)

      const codeElement = screen.getByText('VERYLONGPROMOTIONCODE2024SPECIAL')
      expect(codeElement).toHaveClass('truncate')
    })

    it('handles very long descriptions', () => {
      const longDescPromo = createMockPromotion({
        description: 'A'.repeat(200),
      })
      render(<PromotionCard promotion={longDescPromo} />)

      const description = screen.getByText(/A{3,}/)
      expect(description).toHaveClass('line-clamp-2')
    })

    it('handles missing optional fields gracefully', () => {
      const minimalPromo = {
        id: 'promo-1',
        code: 'TEST',
        discount_type: 'percentage',
        discount_value: 10,
        active: true,
      }
      render(<PromotionCard promotion={minimalPromo} />)

      expect(screen.getByText('TEST')).toBeInTheDocument()
    })
  })
})
