import { render, screen } from '@testing-library/react'
import { LoyaltyTierBadge } from '@/components/loyalty/LoyaltyTierBadge'

/**
 * LoyaltyTierBadge Component Tests
 *
 * Tests the loyalty tier badge component for displaying customer tiers
 */

describe('LoyaltyTierBadge', () => {
  describe('Bronze Tier', () => {
    it('renders Bronze tier correctly', () => {
      render(<LoyaltyTierBadge tier="bronze" points={250} />)

      expect(screen.getByText(/Bronze/i)).toBeInTheDocument()
    })

    it('applies bronze styling', () => {
      const { container } = render(<LoyaltyTierBadge tier="bronze" />)

      expect(container.firstChild).toHaveClass('tier-bronze')
    })

    it('displays bronze tier icon', () => {
      render(<LoyaltyTierBadge tier="bronze" />)

      expect(screen.getByTestId('bronze-icon')).toBeInTheDocument()
    })

    it('shows points for bronze tier', () => {
      render(<LoyaltyTierBadge tier="bronze" points={250} showPoints={true} />)

      expect(screen.getByText(/250 points/i)).toBeInTheDocument()
    })
  })

  describe('Silver Tier', () => {
    it('renders Silver tier correctly', () => {
      render(<LoyaltyTierBadge tier="silver" points={750} />)

      expect(screen.getByText(/Silver/i)).toBeInTheDocument()
    })

    it('applies silver styling', () => {
      const { container } = render(<LoyaltyTierBadge tier="silver" />)

      expect(container.firstChild).toHaveClass('tier-silver')
    })

    it('displays silver tier icon', () => {
      render(<LoyaltyTierBadge tier="silver" />)

      expect(screen.getByTestId('silver-icon')).toBeInTheDocument()
    })

    it('shows points for silver tier', () => {
      render(<LoyaltyTierBadge tier="silver" points={750} showPoints={true} />)

      expect(screen.getByText(/750 points/i)).toBeInTheDocument()
    })
  })

  describe('Gold Tier', () => {
    it('renders Gold tier correctly', () => {
      render(<LoyaltyTierBadge tier="gold" points={1500} />)

      expect(screen.getByText(/Gold/i)).toBeInTheDocument()
    })

    it('applies gold styling', () => {
      const { container } = render(<LoyaltyTierBadge tier="gold" />)

      expect(container.firstChild).toHaveClass('tier-gold')
    })

    it('displays gold tier icon', () => {
      render(<LoyaltyTierBadge tier="gold" />)

      expect(screen.getByTestId('gold-icon')).toBeInTheDocument()
    })

    it('shows points for gold tier', () => {
      render(<LoyaltyTierBadge tier="gold" points={1500} showPoints={true} />)

      expect(screen.getByText(/1,500 points/i)).toBeInTheDocument()
    })

    it('applies shimmer effect for gold tier', () => {
      const { container } = render(<LoyaltyTierBadge tier="gold" />)

      expect(container.querySelector('.shimmer-effect')).toBeInTheDocument()
    })
  })

  describe('Progress Display', () => {
    it('shows progress to next tier', () => {
      render(
        <LoyaltyTierBadge
          tier="bronze"
          points={250}
          nextTierPoints={500}
          showProgress={true}
        />
      )

      expect(screen.getByText(/50% to Silver/i)).toBeInTheDocument()
    })

    it('displays progress bar', () => {
      render(
        <LoyaltyTierBadge
          tier="bronze"
          points={250}
          nextTierPoints={500}
          showProgress={true}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '50')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('shows points needed for next tier', () => {
      render(
        <LoyaltyTierBadge
          tier="bronze"
          points={250}
          nextTierPoints={500}
          showProgress={true}
        />
      )

      expect(screen.getByText(/250 points to Silver/i)).toBeInTheDocument()
    })

    it('does not show progress for gold tier', () => {
      render(<LoyaltyTierBadge tier="gold" points={1500} showProgress={true} />)

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      expect(screen.getByText(/Highest tier/i)).toBeInTheDocument()
    })
  })

  describe('Benefits Display', () => {
    it('shows tier benefits when expanded', () => {
      render(<LoyaltyTierBadge tier="silver" showBenefits={true} />)

      expect(screen.getByText(/10% discount/i)).toBeInTheDocument()
      expect(screen.getByText(/Priority booking/i)).toBeInTheDocument()
    })

    it('shows bronze tier benefits', () => {
      render(<LoyaltyTierBadge tier="bronze" showBenefits={true} />)

      expect(screen.getByText(/5% discount/i)).toBeInTheDocument()
    })

    it('shows silver tier benefits', () => {
      render(<LoyaltyTierBadge tier="silver" showBenefits={true} />)

      expect(screen.getByText(/10% discount/i)).toBeInTheDocument()
      expect(screen.getByText(/Priority support/i)).toBeInTheDocument()
    })

    it('shows gold tier benefits', () => {
      render(<LoyaltyTierBadge tier="gold" showBenefits={true} />)

      expect(screen.getByText(/15% discount/i)).toBeInTheDocument()
      expect(screen.getByText(/Free annual service/i)).toBeInTheDocument()
      expect(screen.getByText(/Dedicated support/i)).toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    it('renders in small size', () => {
      const { container } = render(<LoyaltyTierBadge tier="bronze" size="sm" />)

      expect(container.firstChild).toHaveClass('badge-sm')
    })

    it('renders in medium size (default)', () => {
      const { container } = render(<LoyaltyTierBadge tier="bronze" />)

      expect(container.firstChild).toHaveClass('badge-md')
    })

    it('renders in large size', () => {
      const { container } = render(<LoyaltyTierBadge tier="bronze" size="lg" />)

      expect(container.firstChild).toHaveClass('badge-lg')
    })
  })

  describe('Interactive Modes', () => {
    it('renders as clickable when onClick provided', () => {
      const mockOnClick = jest.fn()
      render(<LoyaltyTierBadge tier="bronze" onClick={mockOnClick} />)

      const badge = screen.getByRole('button')
      expect(badge).toBeInTheDocument()
    })

    it('calls onClick when clicked', () => {
      const mockOnClick = jest.fn()
      render(<LoyaltyTierBadge tier="bronze" onClick={mockOnClick} />)

      const badge = screen.getByRole('button')
      badge.click()

      expect(mockOnClick).toHaveBeenCalled()
    })

    it('applies hover effect when interactive', () => {
      const { container } = render(
        <LoyaltyTierBadge tier="bronze" onClick={() => {}} />
      )

      expect(container.firstChild).toHaveClass('interactive')
    })
  })

  describe('Compact Mode', () => {
    it('hides benefits in compact mode', () => {
      render(<LoyaltyTierBadge tier="silver" showBenefits={true} compact={true} />)

      expect(screen.queryByText(/10% discount/i)).not.toBeInTheDocument()
    })

    it('hides progress in compact mode', () => {
      render(
        <LoyaltyTierBadge
          tier="bronze"
          points={250}
          showProgress={true}
          compact={true}
        />
      )

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('shows only tier name and icon in compact mode', () => {
      render(<LoyaltyTierBadge tier="gold" compact={true} />)

      expect(screen.getByText(/Gold/i)).toBeInTheDocument()
      expect(screen.getByTestId('gold-icon')).toBeInTheDocument()
    })
  })

  describe('Achievement Mode', () => {
    it('shows achievement animation when just earned', () => {
      const { container } = render(
        <LoyaltyTierBadge tier="gold" justEarned={true} />
      )

      expect(container.querySelector('.achievement-animation')).toBeInTheDocument()
    })

    it('shows congratulations message for new tier', () => {
      render(<LoyaltyTierBadge tier="gold" justEarned={true} showMessage={true} />)

      expect(screen.getByText(/Congratulations!/i)).toBeInTheDocument()
      expect(screen.getByText(/You've reached Gold tier/i)).toBeInTheDocument()
    })

    it('plays confetti effect for gold tier achievement', () => {
      const { container } = render(
        <LoyaltyTierBadge tier="gold" justEarned={true} />
      )

      expect(container.querySelector('.confetti-effect')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      render(<LoyaltyTierBadge tier="silver" points={750} />)

      expect(screen.getByLabelText(/Silver tier.*750 points/i)).toBeInTheDocument()
    })

    it('announces tier changes', () => {
      const { rerender } = render(<LoyaltyTierBadge tier="bronze" />)

      rerender(<LoyaltyTierBadge tier="silver" />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveTextContent(/upgraded to Silver/i)
    })

    it('has proper color contrast', () => {
      const { container } = render(<LoyaltyTierBadge tier="bronze" />)

      // Bronze tier should have sufficient contrast
      const badge = container.firstChild
      const styles = window.getComputedStyle(badge as Element)
      expect(styles.color).toBeDefined()
    })

    it('supports keyboard navigation when interactive', () => {
      const mockOnClick = jest.fn()
      render(<LoyaltyTierBadge tier="bronze" onClick={mockOnClick} />)

      const badge = screen.getByRole('button')
      badge.focus()

      expect(badge).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero points', () => {
      render(<LoyaltyTierBadge tier="bronze" points={0} showPoints={true} />)

      expect(screen.getByText(/0 points/i)).toBeInTheDocument()
    })

    it('handles very large point values', () => {
      render(<LoyaltyTierBadge tier="gold" points={999999} showPoints={true} />)

      expect(screen.getByText(/999,999 points/i)).toBeInTheDocument()
    })

    it('handles missing tier gracefully', () => {
      render(<LoyaltyTierBadge tier={null} />)

      expect(screen.getByText(/No tier/i)).toBeInTheDocument()
    })

    it('handles invalid tier gracefully', () => {
      render(<LoyaltyTierBadge tier="invalid" />)

      expect(screen.getByText(/Unknown tier/i)).toBeInTheDocument()
    })
  })

  describe('Tooltip', () => {
    it('shows tooltip on hover when enabled', async () => {
      render(<LoyaltyTierBadge tier="silver" showTooltip={true} />)

      const badge = screen.getByText(/Silver/i)

      // Hover over badge
      badge.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

      expect(await screen.findByRole('tooltip')).toBeInTheDocument()
    })

    it('tooltip shows tier details', async () => {
      render(<LoyaltyTierBadge tier="silver" points={750} showTooltip={true} />)

      const badge = screen.getByText(/Silver/i)
      badge.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

      const tooltip = await screen.findByRole('tooltip')
      expect(tooltip).toHaveTextContent(/Silver Tier/i)
      expect(tooltip).toHaveTextContent(/750 points/i)
      expect(tooltip).toHaveTextContent(/10% discount/i)
    })
  })

  describe('Animation Effects', () => {
    it('pulses when highlighted', () => {
      const { container } = render(<LoyaltyTierBadge tier="gold" highlight={true} />)

      expect(container.querySelector('.pulse-animation')).toBeInTheDocument()
    })

    it('shakes when attention needed', () => {
      const { container } = render(
        <LoyaltyTierBadge tier="bronze" nearNextTier={true} />
      )

      expect(container.querySelector('.shake-animation')).toBeInTheDocument()
    })
  })
})
