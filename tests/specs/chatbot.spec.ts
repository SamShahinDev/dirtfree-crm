/**
 * Chatbot E2E Tests
 *
 * Tests AI chatbot customer interactions and escalation to human agents
 */

import { test, expect } from '@playwright/test'
import { loginAsStaff, loginAsCustomer, logout } from '../helpers/auth'

test.describe('Chatbot Interactions', () => {
  test.describe('Customer Chatbot Experience', () => {
    test.beforeEach(async ({ page }) => {
      // Login as customer
      await loginAsCustomer(page)
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('initiates chat conversation', async ({ page }) => {
      // Navigate to portal
      await page.goto('/portal')

      // Click chat widget
      await page.click('[data-testid="chat-widget"]')

      // Verify chat window opens
      await expect(page.locator('[data-testid="chat-window"]')).toBeVisible()

      // Verify welcome message from bot
      await expect(page.locator('[data-role="assistant"]').first()).toBeVisible()
      await expect(page.locator('text=How can I help you today?')).toBeVisible()

      // Verify quick reply options
      await expect(page.locator('[data-testid="quick-replies"]')).toBeVisible()
    })

    test('sends customer query and receives bot response', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Wait for chat to load
      await expect(page.locator('[data-testid="chat-window"]')).toBeVisible()

      // Type customer query
      await page.fill('[data-testid="chat-input"]', 'I need to schedule a carpet cleaning')

      // Send message
      await page.click('[data-testid="send-message"]')

      // Verify customer message appears
      await expect(page.locator('[data-role="user"]').last()).toContainText('carpet cleaning')

      // Wait for bot response
      await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible()

      // Verify bot response
      await expect(page.locator('[data-role="assistant"]').last()).toBeVisible()
      await expect(page.locator('text=help you schedule')).toBeVisible()

      // Verify follow-up options provided
      await expect(page.locator('[data-testid="quick-replies"]')).toBeVisible()
    })

    test('uses quick reply buttons', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Wait for welcome message
      await expect(page.locator('[data-testid="quick-replies"]')).toBeVisible()

      // Click quick reply option
      await page.click('[data-quick-reply="booking"]')

      // Verify selection sent as message
      await expect(page.locator('[data-role="user"]').last()).toBeVisible()

      // Verify bot responds to selection
      await expect(page.locator('[data-role="assistant"]').last()).toBeVisible()
      await expect(page.locator('text=What date works best')).toBeVisible()
    })

    test('bot provides service information', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Ask about services
      await page.fill('[data-testid="chat-input"]', 'What services do you offer?')
      await page.click('[data-testid="send-message"]')

      // Wait for response
      await expect(page.locator('[data-role="assistant"]').last()).toBeVisible()

      // Verify service list provided
      await expect(page.locator('text=Carpet Cleaning')).toBeVisible()
      await expect(page.locator('text=Tile & Grout')).toBeVisible()

      // Verify links or buttons to learn more
      await expect(page.locator('[data-action="view-services"]')).toBeVisible()
    })

    test('bot provides pricing information', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Ask about pricing
      await page.fill('[data-testid="chat-input"]', 'How much does carpet cleaning cost?')
      await page.click('[data-testid="send-message"]')

      // Wait for response
      await expect(page.locator('[data-role="assistant"]').last()).toBeVisible()

      // Verify pricing information provided
      await expect(page.locator('[data-role="assistant"]').last()).toContainText(/\$\d+/)

      // Verify option to get exact quote
      await expect(page.locator('text=exact quote')).toBeVisible()
    })

    test('escalates to human agent when requested', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Request human agent
      await page.fill('[data-testid="chat-input"]', 'I want to speak to a real person')
      await page.click('[data-testid="send-message"]')

      // Verify escalation message from system
      await expect(page.locator('[data-role="system"]').last()).toBeVisible()
      await expect(page.locator('text=connecting you with a support agent')).toBeVisible()

      // Verify escalation status indicator
      await expect(page.locator('[data-testid="chat-status"]')).toHaveText(/waiting|connecting/)

      // Verify escalation reason logged
      await expect(page.locator('[data-testid="escalation-reason"]')).toContainText('customer_request')
    })

    test('escalates due to low confidence response', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Ask complex or ambiguous question
      await page.fill('[data-testid="chat-input"]', 'Can you remove wine stains from silk?')
      await page.click('[data-testid="send-message"]')

      // Wait for bot to respond
      await expect(page.locator('[data-role="assistant"]').last()).toBeVisible()

      // If bot has low confidence, it should offer human agent
      const escalationOffer = page.locator('text=connect you with a specialist')
      if (await escalationOffer.isVisible()) {
        // Click connect to agent button
        await page.click('button:has-text("Connect to Agent")')

        // Verify escalation initiated
        await expect(page.locator('[data-role="system"]').last()).toContainText('connecting')
      }
    })

    test('detects frustration and offers escalation', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Send multiple frustrated messages
      await page.fill('[data-testid="chat-input"]', 'This is not helping')
      await page.click('[data-testid="send-message"]')

      await page.fill('[data-testid="chat-input"]', 'I need help now')
      await page.click('[data-testid="send-message"]')

      await page.fill('[data-testid="chat-input"]', 'This is frustrating')
      await page.click('[data-testid="send-message"]')

      // Verify bot detects frustration and offers help
      await expect(page.locator('[data-role="assistant"]').last()).toBeVisible()
      await expect(page.locator('text=connect you with someone')).toBeVisible()

      // Verify escalation option provided
      await expect(page.locator('button:has-text("Speak to Agent")')).toBeVisible()
    })

    test('views conversation history', async ({ page }) => {
      // Open chat
      await page.goto('/portal')
      await page.click('[data-testid="chat-widget"]')

      // Send several messages
      await page.fill('[data-testid="chat-input"]', 'Hello')
      await page.click('[data-testid="send-message"]')

      await page.fill('[data-testid="chat-input"]', 'I need help')
      await page.click('[data-testid="send-message"]')

      // Scroll up to view history
      await page.locator('[data-testid="chat-messages"]').evaluate((el) => {
        el.scrollTop = 0
      })

      // Verify all messages visible
      await expect(page.locator('[data-role="user"]')).toHaveCount(2)

      // Close and reopen chat
      await page.click('[data-testid="close-chat"]')
      await page.click('[data-testid="chat-widget"]')

      // Verify conversation persists
      await expect(page.locator('[data-role="user"]').first()).toContainText('Hello')
    })
  })

  test.describe('Agent Chat Management', () => {
    test.beforeEach(async ({ page }) => {
      // Login as staff support agent
      await loginAsStaff(page, 'manager')
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('agent views escalated chat queue', async ({ page }) => {
      // Navigate to chat dashboard
      await page.goto('/dashboard/support/chats')

      // Verify chat queue visible
      await expect(page.locator('h1:has-text("Support Chats")')).toBeVisible()

      // Verify escalated chats listed
      await expect(page.locator('[data-testid="escalated-chats"]')).toBeVisible()

      // Verify queue count
      await expect(page.locator('[data-testid="queue-count"]')).toBeVisible()

      // Verify chat cards show customer info
      await expect(page.locator('[data-testid="chat-card"]').first()).toBeVisible()
      await expect(page.locator('[data-testid="customer-name"]').first()).toBeVisible()
      await expect(page.locator('[data-testid="wait-time"]').first()).toBeVisible()
    })

    test('agent accepts escalated chat', async ({ page }) => {
      // Navigate to chat queue
      await page.goto('/dashboard/support/chats')

      // Click on escalated chat
      await page.click('[data-testid="chat-card"]:first-child')

      // Verify chat preview modal
      await expect(page.locator('[data-testid="chat-preview"]')).toBeVisible()

      // Verify conversation history shown
      await expect(page.locator('[data-testid="conversation-history"]')).toBeVisible()

      // Verify escalation reason shown
      await expect(page.locator('[data-testid="escalation-reason"]')).toBeVisible()

      // Click accept chat button
      await page.click('button:has-text("Accept Chat")')

      // Verify chat window opens
      await expect(page.locator('[data-testid="active-chat-window"]')).toBeVisible()

      // Verify customer notified
      await expect(page.locator('[data-role="system"]').last()).toContainText('agent has joined')

      // Verify chat input enabled
      await expect(page.locator('[data-testid="agent-chat-input"]')).toBeEnabled()
    })

    test('agent sends message to customer', async ({ page }) => {
      // Navigate and accept chat
      await page.goto('/dashboard/support/chats')
      await page.click('[data-testid="chat-card"]:first-child')
      await page.click('button:has-text("Accept Chat")')

      // Type agent response
      await page.fill('[data-testid="agent-chat-input"]', 'Hello! I\'m here to help. What can I assist you with?')

      // Send message
      await page.click('[data-testid="send-agent-message"]')

      // Verify message appears in chat
      await expect(page.locator('[data-role="agent"]').last()).toContainText('here to help')

      // Verify timestamp shown
      await expect(page.locator('[data-role="agent"]').last().locator('[data-testid="timestamp"]')).toBeVisible()
    })

    test('agent uses canned responses', async ({ page }) => {
      // Navigate and accept chat
      await page.goto('/dashboard/support/chats')
      await page.click('[data-testid="chat-card"]:first-child')
      await page.click('button:has-text("Accept Chat")')

      // Click canned responses button
      await page.click('[data-testid="canned-responses"]')

      // Verify responses menu opens
      await expect(page.locator('[data-testid="canned-responses-menu"]')).toBeVisible()

      // Select a canned response
      await page.click('[data-canned-response="greeting"]')

      // Verify response inserted into input
      await expect(page.locator('[data-testid="agent-chat-input"]')).toHaveValue(/Hello/)

      // Send message
      await page.click('[data-testid="send-agent-message"]')

      // Verify message sent
      await expect(page.locator('[data-role="agent"]').last()).toBeVisible()
    })

    test('agent resolves chat conversation', async ({ page }) => {
      // Navigate and accept chat
      await page.goto('/dashboard/support/chats')
      await page.click('[data-testid="chat-card"]:first-child')
      await page.click('button:has-text("Accept Chat")')

      // Send resolution message
      await page.fill('[data-testid="agent-chat-input"]', 'Is there anything else I can help you with?')
      await page.click('[data-testid="send-agent-message"]')

      // Click resolve chat button
      await page.click('button:has-text("Resolve Chat")')

      // Fill resolution form
      await page.selectOption('[name="resolution_category"]', 'resolved')
      await page.fill('[name="resolution_notes"]', 'Customer inquiry answered successfully')

      // Confirm resolution
      await page.click('button:has-text("Confirm Resolution")')

      // Verify success message
      await expect(page.locator('text=Chat resolved')).toBeVisible()

      // Verify chat removed from queue
      await expect(page.locator('[data-testid="chat-queue"]')).not.toContainText('resolved chat')
    })

    test('agent transfers chat to another agent', async ({ page }) => {
      // Navigate and accept chat
      await page.goto('/dashboard/support/chats')
      await page.click('[data-testid="chat-card"]:first-child')
      await page.click('button:has-text("Accept Chat")')

      // Click transfer button
      await page.click('button:has-text("Transfer")')

      // Select agent to transfer to
      await page.selectOption('[name="transfer_to_agent"]', { index: 1 })

      // Add transfer note
      await page.fill('[name="transfer_note"]', 'Customer needs billing specialist')

      // Confirm transfer
      await page.click('button:has-text("Confirm Transfer")')

      // Verify transfer success
      await expect(page.locator('text=Chat transferred')).toBeVisible()

      // Verify customer notified
      await expect(page.locator('[data-role="system"]').last()).toContainText('transferred')
    })

    test('agent views chat analytics', async ({ page }) => {
      // Navigate to chat analytics
      await page.goto('/dashboard/support/analytics')

      // Verify analytics dashboard
      await expect(page.locator('h1:has-text("Chat Analytics")')).toBeVisible()

      // Verify metrics displayed
      await expect(page.locator('[data-metric="total-chats"]')).toBeVisible()
      await expect(page.locator('[data-metric="avg-response-time"]')).toBeVisible()
      await expect(page.locator('[data-metric="resolution-rate"]')).toBeVisible()
      await expect(page.locator('[data-metric="satisfaction-score"]')).toBeVisible()

      // Verify escalation metrics
      await expect(page.locator('[data-metric="escalation-rate"]')).toBeVisible()
      await expect(page.locator('[data-metric="bot-resolution-rate"]')).toBeVisible()

      // Verify charts
      await expect(page.locator('[data-testid="chat-volume-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="escalation-reasons-chart"]')).toBeVisible()
    })
  })

  test.describe('Chatbot Training and Configuration', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsStaff(page, 'admin')
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('admin configures chatbot responses', async ({ page }) => {
      // Navigate to chatbot settings
      await page.goto('/dashboard/settings/chatbot')

      // Verify settings page
      await expect(page.locator('h1:has-text("Chatbot Configuration")')).toBeVisible()

      // Update welcome message
      await page.fill('[name="welcome_message"]', 'Welcome! How can I assist you today?')

      // Update escalation threshold
      await page.fill('[name="confidence_threshold"]', '0.7')

      // Update max conversation turns
      await page.fill('[name="max_turns_before_escalation"]', '5')

      // Save settings
      await page.click('button:has-text("Save Settings")')

      // Verify success
      await expect(page.locator('text=Settings saved')).toBeVisible()
    })

    test('admin adds knowledge base article', async ({ page }) => {
      // Navigate to knowledge base
      await page.goto('/dashboard/chatbot/knowledge-base')

      // Click add article
      await page.click('button:has-text("Add Article")')

      // Fill article details
      await page.fill('[name="title"]', 'How to prepare for carpet cleaning')
      await page.fill('[name="content"]', 'Remove small items from the floor. Vacuum if possible. Move furniture if needed.')
      await page.fill('[name="keywords"]', 'prepare, preparation, before service')

      // Save article
      await page.click('button:has-text("Save Article")')

      // Verify article created
      await expect(page.locator('text=Article added')).toBeVisible()
    })
  })
})
