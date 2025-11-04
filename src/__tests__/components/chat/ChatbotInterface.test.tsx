import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatbotInterface } from '@/components/chat/ChatbotInterface'

/**
 * ChatbotInterface Component Tests
 *
 * Tests the AI chatbot interface component
 */

describe('ChatbotInterface', () => {
  const user = userEvent.setup()

  it('renders chat interface correctly', () => {
    render(<ChatbotInterface />)

    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('displays welcome message on mount', () => {
    render(<ChatbotInterface />)

    expect(screen.getByText(/How can I help you today/i)).toBeInTheDocument()
  })

  describe('Sending Messages', () => {
    it('allows typing a message', async () => {
      render(<ChatbotInterface />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Hello bot')

      expect(input).toHaveValue('Hello bot')
    })

    it('sends message when send button clicked', async () => {
      const mockOnSendMessage = jest.fn()
      render(<ChatbotInterface onSendMessage={mockOnSendMessage} />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Hello bot')

      const sendButton = screen.getByRole('button', { name: /send/i })
      fireEvent.click(sendButton)

      expect(mockOnSendMessage).toHaveBeenCalledWith('Hello bot')
    })

    it('sends message when Enter key pressed', async () => {
      const mockOnSendMessage = jest.fn()
      render(<ChatbotInterface onSendMessage={mockOnSendMessage} />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Hello bot{Enter}')

      expect(mockOnSendMessage).toHaveBeenCalledWith('Hello bot')
    })

    it('does not send when Shift+Enter pressed', async () => {
      const mockOnSendMessage = jest.fn()
      render(<ChatbotInterface onSendMessage={mockOnSendMessage} />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

      expect(mockOnSendMessage).not.toHaveBeenCalled()
      expect(input).toHaveValue('Line 1\nLine 2')
    })

    it('clears input after sending', async () => {
      render(<ChatbotInterface />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Hello bot')

      const sendButton = screen.getByRole('button', { name: /send/i })
      fireEvent.click(sendButton)

      expect(input).toHaveValue('')
    })

    it('disables send button when input is empty', () => {
      render(<ChatbotInterface />)

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).toBeDisabled()
    })

    it('enables send button when input has text', async () => {
      render(<ChatbotInterface />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Hello')

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).not.toBeDisabled()
    })
  })

  describe('Message Display', () => {
    it('displays user messages', async () => {
      render(<ChatbotInterface />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Hello bot{Enter}')

      expect(screen.getByText('Hello bot')).toBeInTheDocument()
    })

    it('displays bot responses', async () => {
      render(
        <ChatbotInterface
          messages={[
            { id: '1', role: 'user', content: 'Hello' },
            { id: '2', role: 'assistant', content: 'Hi! How can I help?' },
          ]}
        />
      )

      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument()
    })

    it('applies correct styling to user messages', () => {
      render(
        <ChatbotInterface
          messages={[{ id: '1', role: 'user', content: 'Hello' }]}
        />
      )

      const userMessage = screen.getByText('Hello').closest('.message')
      expect(userMessage).toHaveClass('message-user')
    })

    it('applies correct styling to bot messages', () => {
      render(
        <ChatbotInterface
          messages={[{ id: '1', role: 'assistant', content: 'Hello' }]}
        />
      )

      const botMessage = screen.getByText('Hello').closest('.message')
      expect(botMessage).toHaveClass('message-assistant')
    })

    it('displays message timestamps', () => {
      render(
        <ChatbotInterface
          messages={[
            {
              id: '1',
              role: 'user',
              content: 'Hello',
              timestamp: '2024-11-20T10:00:00Z',
            },
          ]}
          showTimestamps={true}
        />
      )

      expect(screen.getByText(/10:00/i)).toBeInTheDocument()
    })

    it('auto-scrolls to latest message', async () => {
      const { container } = render(<ChatbotInterface />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Message 1{Enter}')
      await user.type(input, 'Message 2{Enter}')
      await user.type(input, 'Message 3{Enter}')

      const chatContainer = container.querySelector('.chat-messages')
      expect(chatContainer?.scrollTop).toBe(chatContainer?.scrollHeight)
    })
  })

  describe('Loading States', () => {
    it('shows typing indicator when bot is responding', () => {
      render(<ChatbotInterface isLoading={true} />)

      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
    })

    it('disables input when bot is responding', () => {
      render(<ChatbotInterface isLoading={true} />)

      const input = screen.getByRole('textbox', { name: /message/i })
      expect(input).toBeDisabled()
    })

    it('shows animated dots in typing indicator', () => {
      render(<ChatbotInterface isLoading={true} />)

      const dots = screen.getAllByTestId('typing-dot')
      expect(dots).toHaveLength(3)
    })
  })

  describe('Suggestions', () => {
    it('displays quick reply suggestions', () => {
      const suggestions = [
        'Schedule a service',
        'Check my appointments',
        'View promotions',
      ]

      render(<ChatbotInterface suggestions={suggestions} />)

      expect(screen.getByText('Schedule a service')).toBeInTheDocument()
      expect(screen.getByText('Check my appointments')).toBeInTheDocument()
      expect(screen.getByText('View promotions')).toBeInTheDocument()
    })

    it('sends suggestion when clicked', () => {
      const mockOnSendMessage = jest.fn()
      const suggestions = ['Schedule a service']

      render(
        <ChatbotInterface
          suggestions={suggestions}
          onSendMessage={mockOnSendMessage}
        />
      )

      const suggestionButton = screen.getByText('Schedule a service')
      fireEvent.click(suggestionButton)

      expect(mockOnSendMessage).toHaveBeenCalledWith('Schedule a service')
    })

    it('hides suggestions after selection', () => {
      const suggestions = ['Schedule a service']

      render(<ChatbotInterface suggestions={suggestions} />)

      const suggestionButton = screen.getByText('Schedule a service')
      fireEvent.click(suggestionButton)

      expect(screen.queryByText('Schedule a service')).not.toBeInTheDocument()
    })
  })

  describe('Context Awareness', () => {
    it('displays customer context when provided', () => {
      render(
        <ChatbotInterface
          context={{
            customer_name: 'John Doe',
            last_service: 'Carpet Cleaning',
          }}
          showContext={true}
        />
      )

      expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
      expect(screen.getByText(/Carpet Cleaning/i)).toBeInTheDocument()
    })

    it('shows current booking context', () => {
      render(
        <ChatbotInterface
          context={{
            active_booking: true,
            service_type: 'Tile & Grout',
          }}
          showContext={true}
        />
      )

      expect(screen.getByText(/Current booking/i)).toBeInTheDocument()
      expect(screen.getByText(/Tile & Grout/i)).toBeInTheDocument()
    })
  })

  describe('Rich Message Formats', () => {
    it('displays messages with markdown formatting', () => {
      render(
        <ChatbotInterface
          messages={[
            {
              id: '1',
              role: 'assistant',
              content: '**Bold text** and *italic text*',
            },
          ]}
        />
      )

      expect(screen.getByText('Bold text')).toHaveStyle({ fontWeight: 'bold' })
    })

    it('displays messages with links', () => {
      render(
        <ChatbotInterface
          messages={[
            {
              id: '1',
              role: 'assistant',
              content: 'Visit [our website](https://example.com)',
            },
          ]}
        />
      )

      const link = screen.getByRole('link', { name: /our website/i })
      expect(link).toHaveAttribute('href', 'https://example.com')
    })

    it('displays messages with buttons', () => {
      render(
        <ChatbotInterface
          messages={[
            {
              id: '1',
              role: 'assistant',
              content: 'Choose an option:',
              buttons: [
                { label: 'Option 1', value: 'opt1' },
                { label: 'Option 2', value: 'opt2' },
              ],
            },
          ]}
        />
      )

      expect(screen.getByRole('button', { name: 'Option 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Option 2' })).toBeInTheDocument()
    })

    it('handles button clicks', () => {
      const mockOnSendMessage = jest.fn()
      render(
        <ChatbotInterface
          messages={[
            {
              id: '1',
              role: 'assistant',
              content: 'Choose:',
              buttons: [{ label: 'Yes', value: 'yes' }],
            },
          ]}
          onSendMessage={mockOnSendMessage}
        />
      )

      const button = screen.getByRole('button', { name: 'Yes' })
      fireEvent.click(button)

      expect(mockOnSendMessage).toHaveBeenCalledWith('yes')
    })
  })

  describe('Error Handling', () => {
    it('displays error message', () => {
      render(<ChatbotInterface error="Failed to send message" />)

      expect(screen.getByText(/Failed to send message/i)).toBeInTheDocument()
    })

    it('allows retrying after error', () => {
      const mockOnRetry = jest.fn()
      render(
        <ChatbotInterface error="Connection failed" onRetry={mockOnRetry} />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalled()
    })

    it('clears error when new message sent', async () => {
      const { rerender } = render(<ChatbotInterface error="Some error" />)

      expect(screen.getByText(/Some error/i)).toBeInTheDocument()

      rerender(<ChatbotInterface error={null} />)

      expect(screen.queryByText(/Some error/i)).not.toBeInTheDocument()
    })
  })

  describe('Conversation Actions', () => {
    it('shows clear conversation button', () => {
      render(<ChatbotInterface allowClear={true} />)

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })

    it('calls onClear when clear button clicked', () => {
      const mockOnClear = jest.fn()
      render(<ChatbotInterface allowClear={true} onClear={mockOnClear} />)

      const clearButton = screen.getByRole('button', { name: /clear/i })
      fireEvent.click(clearButton)

      expect(mockOnClear).toHaveBeenCalled()
    })

    it('shows confirmation before clearing', () => {
      render(<ChatbotInterface allowClear={true} />)

      const clearButton = screen.getByRole('button', { name: /clear/i })
      fireEvent.click(clearButton)

      expect(screen.getByText(/Are you sure/i)).toBeInTheDocument()
    })

    it('exports conversation', () => {
      const mockOnExport = jest.fn()
      render(<ChatbotInterface allowExport={true} onExport={mockOnExport} />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      expect(mockOnExport).toHaveBeenCalled()
    })
  })

  describe('Minimized Mode', () => {
    it('renders minimized when prop is true', () => {
      const { container } = render(<ChatbotInterface minimized={true} />)

      expect(container.firstChild).toHaveClass('chat-minimized')
    })

    it('shows only chat bubble when minimized', () => {
      render(<ChatbotInterface minimized={true} />)

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByTestId('chat-bubble')).toBeInTheDocument()
    })

    it('expands when bubble clicked', () => {
      const mockOnToggle = jest.fn()
      render(<ChatbotInterface minimized={true} onToggleMinimize={mockOnToggle} />)

      const bubble = screen.getByTestId('chat-bubble')
      fireEvent.click(bubble)

      expect(mockOnToggle).toHaveBeenCalledWith(false)
    })

    it('shows unread badge when minimized with new messages', () => {
      render(<ChatbotInterface minimized={true} unreadCount={3} />)

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByTestId('unread-badge')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ChatbotInterface />)

      expect(screen.getByLabelText(/Type your message/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Send message/i)).toBeInTheDocument()
    })

    it('has proper ARIA live region for messages', () => {
      render(<ChatbotInterface />)

      expect(screen.getByRole('log')).toBeInTheDocument()
    })

    it('announces new messages to screen readers', async () => {
      render(<ChatbotInterface />)

      const input = screen.getByRole('textbox', { name: /message/i })
      await user.type(input, 'Hello{Enter}')

      const liveRegion = screen.getByRole('log')
      expect(liveRegion).toHaveTextContent('Hello')
    })

    it('supports keyboard navigation', async () => {
      render(<ChatbotInterface />)

      const input = screen.getByRole('textbox')
      input.focus()

      expect(input).toHaveFocus()

      await user.tab()
      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long messages', async () => {
      render(<ChatbotInterface maxLength={500} />)

      const input = screen.getByRole('textbox', { name: /message/i })
      const longMessage = 'A'.repeat(600)

      await user.type(input, longMessage)

      expect(input).toHaveValue('A'.repeat(500))
      expect(screen.getByText(/500 \/ 500/i)).toBeInTheDocument()
    })

    it('handles rapid message sending', async () => {
      const mockOnSendMessage = jest.fn()
      render(<ChatbotInterface onSendMessage={mockOnSendMessage} />)

      const input = screen.getByRole('textbox', { name: /message/i })

      await user.type(input, 'Message 1{Enter}')
      await user.type(input, 'Message 2{Enter}')
      await user.type(input, 'Message 3{Enter}')

      expect(mockOnSendMessage).toHaveBeenCalledTimes(3)
    })

    it('handles empty message history', () => {
      render(<ChatbotInterface messages={[]} />)

      expect(screen.getByText(/How can I help/i)).toBeInTheDocument()
    })
  })
})
