import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReviewRequestCard } from '@/components/reviews/ReviewRequestCard'
import { createMockJob, createMockCustomer } from '@/lib/test-utils'

/**
 * ReviewRequestCard Component Tests
 *
 * Tests the review request card for managing customer review requests
 */

describe('ReviewRequestCard', () => {
  const mockJob = createMockJob({
    id: 'job-1',
    customer_id: 'customer-1',
    service_type: 'Carpet Cleaning',
    completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    status: 'completed',
  })

  const mockCustomer = createMockCustomer({
    id: 'customer-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+15555551234',
  })

  it('renders job and customer details', () => {
    render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Carpet Cleaning')).toBeInTheDocument()
    expect(screen.getByText(/2 days ago/i)).toBeInTheDocument()
  })

  it('displays request status badge', () => {
    render(<ReviewRequestCard job={mockJob} customer={mockCustomer} status="pending" />)

    expect(screen.getByText(/Pending/i)).toBeInTheDocument()
  })

  describe('Actions', () => {
    it('calls onSendRequest when send button clicked', () => {
      const mockOnSendRequest = jest.fn()
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          onSendRequest={mockOnSendRequest}
        />
      )

      const sendButton = screen.getByRole('button', { name: /send request/i })
      fireEvent.click(sendButton)

      expect(mockOnSendRequest).toHaveBeenCalledWith(mockJob.id)
    })

    it('calls onResend when resend button clicked', () => {
      const mockOnResend = jest.fn()
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          status="sent"
          lastSentAt="2024-01-10T00:00:00Z"
          onResend={mockOnResend}
        />
      )

      const resendButton = screen.getByRole('button', { name: /resend/i })
      fireEvent.click(resendButton)

      expect(mockOnResend).toHaveBeenCalledWith(mockJob.id)
    })

    it('calls onViewReview when view button clicked for completed reviews', () => {
      const mockOnViewReview = jest.fn()
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          status="completed"
          reviewId="review-1"
          onViewReview={mockOnViewReview}
        />
      )

      const viewButton = screen.getByRole('button', { name: /view review/i })
      fireEvent.click(viewButton)

      expect(mockOnViewReview).toHaveBeenCalledWith('review-1')
    })

    it('shows channel selection options', () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      const channelSelector = screen.getByRole('combobox', { name: /channel/i })
      expect(channelSelector).toBeInTheDocument()

      fireEvent.change(channelSelector, { target: { value: 'sms' } })
      expect(channelSelector).toHaveValue('sms')
    })

    it('disables send button when no contact info', () => {
      const customerNoContact = createMockCustomer({
        email: null,
        phone: null,
      })
      render(<ReviewRequestCard job={mockJob} customer={customerNoContact} />)

      const sendButton = screen.getByRole('button', { name: /send request/i })
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Status Displays', () => {
    it('shows sent status with timestamp', () => {
      const sentTime = '2024-01-15T10:00:00Z'
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          status="sent"
          lastSentAt={sentTime}
        />
      )

      expect(screen.getByText(/Sent/i)).toBeInTheDocument()
      expect(screen.getByText(/Jan 15/i)).toBeInTheDocument()
    })

    it('shows completed status with rating', () => {
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          status="completed"
          rating={5}
        />
      )

      expect(screen.getByText(/Completed/i)).toBeInTheDocument()
      // Should show 5 filled stars
      const stars = screen.getAllByTestId('star-filled')
      expect(stars).toHaveLength(5)
    })

    it('shows declined status', () => {
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          status="declined"
        />
      )

      expect(screen.getByText(/Declined/i)).toBeInTheDocument()
    })

    it('shows reminder needed indicator', () => {
      const oldSentTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() // 8 days ago
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          status="sent"
          lastSentAt={oldSentTime}
        />
      )

      expect(screen.getByText(/Reminder suggested/i)).toBeInTheDocument()
    })
  })

  describe('Preview Template', () => {
    it('shows template preview button', () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
    })

    it('opens preview modal when preview button clicked', async () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /template preview/i })).toBeInTheDocument()
      })
    })

    it('displays personalized template content in preview', async () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)

      await waitFor(() => {
        expect(screen.getByText(/Hi John/i)).toBeInTheDocument()
        expect(screen.getByText(/Carpet Cleaning/i)).toBeInTheDocument()
      })
    })

    it('allows editing template before sending', async () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      const editButton = screen.getByRole('button', { name: /customize/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /message/i })
        expect(textarea).toBeInTheDocument()
      })
    })
  })

  describe('Contact Information', () => {
    it('displays customer email', () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })

    it('displays customer phone', () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      expect(screen.getByText(/555-555-1234/i)).toBeInTheDocument()
    })

    it('shows email icon for email channel', () => {
      render(
        <ReviewRequestCard job={mockJob} customer={mockCustomer} selectedChannel="email" />
      )

      expect(screen.getByTestId('email-icon')).toBeInTheDocument()
    })

    it('shows SMS icon for SMS channel', () => {
      render(
        <ReviewRequestCard job={mockJob} customer={mockCustomer} selectedChannel="sms" />
      )

      expect(screen.getByTestId('sms-icon')).toBeInTheDocument()
    })
  })

  describe('Timing Indicators', () => {
    it('shows optimal timing badge for recent completions', () => {
      const recentJob = createMockJob({
        completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      })
      render(<ReviewRequestCard job={recentJob} customer={mockCustomer} />)

      expect(screen.getByText(/Optimal timing/i)).toBeInTheDocument()
    })

    it('shows warning for old completions', () => {
      const oldJob = createMockJob({
        completed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      })
      render(<ReviewRequestCard job={oldJob} customer={mockCustomer} />)

      expect(screen.getByText(/Request soon/i)).toBeInTheDocument()
    })

    it('shows too old warning for very old completions', () => {
      const veryOldJob = createMockJob({
        completed_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
      })
      render(<ReviewRequestCard job={veryOldJob} customer={mockCustomer} />)

      expect(screen.getByText(/Too old/i)).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading spinner when sending', () => {
      render(
        <ReviewRequestCard job={mockJob} customer={mockCustomer} isSending={true} />
      )

      expect(screen.getByTestId('sending-spinner')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    })

    it('shows sending progress message', () => {
      render(
        <ReviewRequestCard job={mockJob} customer={mockCustomer} isSending={true} />
      )

      expect(screen.getByText(/Sending.../i)).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('displays error message when send fails', () => {
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          error="Failed to send review request"
        />
      )

      expect(screen.getByText(/Failed to send/i)).toBeInTheDocument()
    })

    it('allows retrying after error', () => {
      const mockOnSendRequest = jest.fn()
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          error="Send failed"
          onSendRequest={mockOnSendRequest}
        />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(mockOnSendRequest).toHaveBeenCalledWith(mockJob.id)
    })

    it('shows invalid contact warning', () => {
      const customerInvalidEmail = createMockCustomer({
        email: 'invalid-email',
      })
      render(<ReviewRequestCard job={mockJob} customer={customerInvalidEmail} />)

      expect(screen.getByText(/Invalid email/i)).toBeInTheDocument()
    })
  })

  describe('Success States', () => {
    it('shows success message after sending', async () => {
      const { rerender } = render(
        <ReviewRequestCard job={mockJob} customer={mockCustomer} isSending={false} />
      )

      rerender(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          isSending={false}
          success={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Request sent successfully/i)).toBeInTheDocument()
      })
    })

    it('auto-dismisses success message', async () => {
      render(
        <ReviewRequestCard job={mockJob} customer={mockCustomer} success={true} />
      )

      expect(screen.getByText(/sent successfully/i)).toBeInTheDocument()

      await waitFor(
        () => {
          expect(screen.queryByText(/sent successfully/i)).not.toBeInTheDocument()
        },
        { timeout: 3500 }
      )
    })
  })

  describe('Bulk Actions', () => {
    it('shows checkbox when in selection mode', () => {
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          selectable={true}
        />
      )

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('calls onSelect when checkbox clicked', () => {
      const mockOnSelect = jest.fn()
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          selectable={true}
          onSelect={mockOnSelect}
        />
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(mockOnSelect).toHaveBeenCalledWith(mockJob.id, true)
    })

    it('shows selected state', () => {
      const { container } = render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          selectable={true}
          selected={true}
        />
      )

      expect(container.firstChild).toHaveClass('selected')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for actions', () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      expect(screen.getByLabelText(/Send review request/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Preview message/i)).toBeInTheDocument()
    })

    it('announces status changes', async () => {
      render(<ReviewRequestCard job={mockJob} customer={mockCustomer} />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toBeInTheDocument()
    })

    it('supports keyboard navigation', () => {
      const mockOnSendRequest = jest.fn()
      render(
        <ReviewRequestCard
          job={mockJob}
          customer={mockCustomer}
          onSendRequest={mockOnSendRequest}
        />
      )

      const sendButton = screen.getByRole('button', { name: /send/i })
      sendButton.focus()

      expect(sendButton).toHaveFocus()

      fireEvent.keyDown(sendButton, { key: 'Enter' })
      expect(mockOnSendRequest).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('handles job without completion date', () => {
      const incompleteJob = createMockJob({
        completed_at: null,
        status: 'scheduled',
      })
      render(<ReviewRequestCard job={incompleteJob} customer={mockCustomer} />)

      expect(screen.getByText(/Not completed/i)).toBeInTheDocument()
    })

    it('handles customer with missing name', () => {
      const customerNoName = createMockCustomer({
        name: null,
      })
      render(<ReviewRequestCard job={mockJob} customer={customerNoName} />)

      expect(screen.getByText(/Customer/i)).toBeInTheDocument()
    })

    it('handles very long service names', () => {
      const jobLongService = createMockJob({
        service_type: 'Premium Carpet and Upholstery Deep Cleaning Service',
      })
      const { container } = render(
        <ReviewRequestCard job={jobLongService} customer={mockCustomer} />
      )

      const serviceElement = screen.getByText(/Premium Carpet/)
      expect(serviceElement).toHaveClass('truncate')
    })
  })
})
