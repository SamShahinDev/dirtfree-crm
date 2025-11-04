import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateSelector } from '@/components/messaging/TemplateSelector'

/**
 * TemplateSelector Component Tests
 *
 * Tests the message template selector component
 */

describe('TemplateSelector', () => {
  const user = userEvent.setup()

  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Service Confirmation',
      category: 'booking',
      subject: 'Your Service Appointment',
      body: 'Hi {{customerName}}, your {{serviceType}} is scheduled for {{date}}.',
      variables: ['customerName', 'serviceType', 'date'],
    },
    {
      id: 'template-2',
      name: 'Review Request',
      category: 'review',
      subject: 'How was your service?',
      body: 'Hi {{customerName}}, we hope you enjoyed your {{serviceType}}!',
      variables: ['customerName', 'serviceType'],
    },
    {
      id: 'template-3',
      name: 'Promotion',
      category: 'marketing',
      subject: 'Special Offer Inside!',
      body: 'Hi {{customerName}}, get {{discount}}% off your next service!',
      variables: ['customerName', 'discount'],
    },
  ]

  it('renders template list', () => {
    render(<TemplateSelector templates={mockTemplates} />)

    expect(screen.getByText('Service Confirmation')).toBeInTheDocument()
    expect(screen.getByText('Review Request')).toBeInTheDocument()
    expect(screen.getByText('Promotion')).toBeInTheDocument()
  })

  describe('Template Selection', () => {
    it('calls onSelect when template clicked', () => {
      const mockOnSelect = jest.fn()
      render(<TemplateSelector templates={mockTemplates} onSelect={mockOnSelect} />)

      const template = screen.getByText('Service Confirmation')
      fireEvent.click(template)

      expect(mockOnSelect).toHaveBeenCalledWith(mockTemplates[0])
    })

    it('highlights selected template', () => {
      const { container } = render(
        <TemplateSelector templates={mockTemplates} selectedId="template-1" />
      )

      const selectedTemplate = screen.getByText('Service Confirmation').closest('.template-item')
      expect(selectedTemplate).toHaveClass('selected')
    })

    it('allows deselecting template', () => {
      const mockOnSelect = jest.fn()
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="template-1"
          onSelect={mockOnSelect}
          allowDeselect={true}
        />
      )

      const template = screen.getByText('Service Confirmation')
      fireEvent.click(template)

      expect(mockOnSelect).toHaveBeenCalledWith(null)
    })
  })

  describe('Filtering', () => {
    it('filters templates by category', () => {
      render(<TemplateSelector templates={mockTemplates} category="booking" />)

      expect(screen.getByText('Service Confirmation')).toBeInTheDocument()
      expect(screen.queryByText('Review Request')).not.toBeInTheDocument()
      expect(screen.queryByText('Promotion')).not.toBeInTheDocument()
    })

    it('shows category filter dropdown', () => {
      render(<TemplateSelector templates={mockTemplates} showCategoryFilter={true} />)

      expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    })

    it('updates filter when category selected', () => {
      render(<TemplateSelector templates={mockTemplates} showCategoryFilter={true} />)

      const categorySelect = screen.getByRole('combobox', { name: /category/i })
      fireEvent.change(categorySelect, { target: { value: 'review' } })

      expect(screen.queryByText('Service Confirmation')).not.toBeInTheDocument()
      expect(screen.getByText('Review Request')).toBeInTheDocument()
    })

    it('filters templates by search query', async () => {
      render(<TemplateSelector templates={mockTemplates} showSearch={true} />)

      const searchInput = screen.getByRole('textbox', { name: /search/i })
      await user.type(searchInput, 'review')

      expect(screen.queryByText('Service Confirmation')).not.toBeInTheDocument()
      expect(screen.getByText('Review Request')).toBeInTheDocument()
    })

    it('searches in template name and body', async () => {
      render(<TemplateSelector templates={mockTemplates} showSearch={true} />)

      const searchInput = screen.getByRole('textbox', { name: /search/i })
      await user.type(searchInput, 'discount')

      expect(screen.getByText('Promotion')).toBeInTheDocument()
    })

    it('shows no results message when search has no matches', async () => {
      render(<TemplateSelector templates={mockTemplates} showSearch={true} />)

      const searchInput = screen.getByRole('textbox', { name: /search/i })
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText(/No templates found/i)).toBeInTheDocument()
    })
  })

  describe('Template Preview', () => {
    it('shows preview button for each template', () => {
      render(<TemplateSelector templates={mockTemplates} showPreview={true} />)

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      expect(previewButtons).toHaveLength(3)
    })

    it('opens preview modal when preview clicked', async () => {
      render(<TemplateSelector templates={mockTemplates} showPreview={true} />)

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      fireEvent.click(previewButtons[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('displays template content in preview', async () => {
      render(<TemplateSelector templates={mockTemplates} showPreview={true} />)

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      fireEvent.click(previewButtons[0])

      await waitFor(() => {
        expect(screen.getByText(/Your Service Appointment/i)).toBeInTheDocument()
        expect(screen.getByText(/is scheduled for/i)).toBeInTheDocument()
      })
    })

    it('allows editing variables in preview', async () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          showPreview={true}
          allowVariableEdit={true}
        />
      )

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      fireEvent.click(previewButtons[0])

      await waitFor(() => {
        expect(screen.getByLabelText(/customerName/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/serviceType/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
      })
    })

    it('replaces variables with values in preview', async () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          showPreview={true}
          variables={{
            customerName: 'John Doe',
            serviceType: 'Carpet Cleaning',
            date: 'Nov 20, 2024',
          }}
        />
      )

      const previewButtons = screen.getAllByRole('button', { name: /preview/i })
      fireEvent.click(previewButtons[0])

      await waitFor(() => {
        expect(screen.getByText(/Hi John Doe/i)).toBeInTheDocument()
        expect(screen.getByText(/Carpet Cleaning/i)).toBeInTheDocument()
        expect(screen.getByText(/Nov 20, 2024/i)).toBeInTheDocument()
      })
    })
  })

  describe('Template Editing', () => {
    it('shows edit button when editing is allowed', () => {
      render(<TemplateSelector templates={mockTemplates} allowEdit={true} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      expect(editButtons.length).toBeGreaterThan(0)
    })

    it('calls onEdit when edit button clicked', () => {
      const mockOnEdit = jest.fn()
      render(
        <TemplateSelector templates={mockTemplates} allowEdit={true} onEdit={mockOnEdit} />
      )

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      fireEvent.click(editButtons[0])

      expect(mockOnEdit).toHaveBeenCalledWith(mockTemplates[0])
    })

    it('shows delete button when deletion is allowed', () => {
      render(<TemplateSelector templates={mockTemplates} allowDelete={true} />)

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('shows confirmation before deleting', () => {
      render(<TemplateSelector templates={mockTemplates} allowDelete={true} />)

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      fireEvent.click(deleteButtons[0])

      expect(screen.getByText(/Are you sure/i)).toBeInTheDocument()
    })

    it('calls onDelete when delete confirmed', async () => {
      const mockOnDelete = jest.fn()
      render(
        <TemplateSelector
          templates={mockTemplates}
          allowDelete={true}
          onDelete={mockOnDelete}
        />
      )

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      fireEvent.click(deleteButtons[0])

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      fireEvent.click(confirmButton)

      expect(mockOnDelete).toHaveBeenCalledWith(mockTemplates[0].id)
    })
  })

  describe('Template Creation', () => {
    it('shows create new template button', () => {
      render(<TemplateSelector templates={mockTemplates} allowCreate={true} />)

      expect(screen.getByRole('button', { name: /create template/i })).toBeInTheDocument()
    })

    it('calls onCreate when create button clicked', () => {
      const mockOnCreate = jest.fn()
      render(
        <TemplateSelector
          templates={mockTemplates}
          allowCreate={true}
          onCreate={mockOnCreate}
        />
      )

      const createButton = screen.getByRole('button', { name: /create template/i })
      fireEvent.click(createButton)

      expect(mockOnCreate).toHaveBeenCalled()
    })
  })

  describe('Template Details', () => {
    it('displays template category badges', () => {
      render(<TemplateSelector templates={mockTemplates} showCategories={true} />)

      expect(screen.getByText(/booking/i)).toBeInTheDocument()
      expect(screen.getByText(/review/i)).toBeInTheDocument()
      expect(screen.getByText(/marketing/i)).toBeInTheDocument()
    })

    it('displays variable count', () => {
      render(<TemplateSelector templates={mockTemplates} showVariables={true} />)

      expect(screen.getByText(/3 variables/i)).toBeInTheDocument() // Service Confirmation
      expect(screen.getByText(/2 variables/i)).toBeInTheDocument() // Review Request
    })

    it('shows template usage count if provided', () => {
      const templatesWithUsage = mockTemplates.map((t, i) => ({
        ...t,
        usageCount: (i + 1) * 10,
      }))

      render(<TemplateSelector templates={templatesWithUsage} showUsage={true} />)

      expect(screen.getByText(/10 uses/i)).toBeInTheDocument()
      expect(screen.getByText(/20 uses/i)).toBeInTheDocument()
      expect(screen.getByText(/30 uses/i)).toBeInTheDocument()
    })

    it('displays template subject', () => {
      render(<TemplateSelector templates={mockTemplates} showSubject={true} />)

      expect(screen.getByText('Your Service Appointment')).toBeInTheDocument()
      expect(screen.getByText('How was your service?')).toBeInTheDocument()
    })
  })

  describe('Layout Modes', () => {
    it('renders in grid layout', () => {
      const { container } = render(
        <TemplateSelector templates={mockTemplates} layout="grid" />
      )

      expect(container.querySelector('.template-grid')).toBeInTheDocument()
    })

    it('renders in list layout', () => {
      const { container } = render(
        <TemplateSelector templates={mockTemplates} layout="list" />
      )

      expect(container.querySelector('.template-list')).toBeInTheDocument()
    })

    it('renders in compact layout', () => {
      const { container } = render(
        <TemplateSelector templates={mockTemplates} layout="compact" />
      )

      expect(container.querySelector('.template-compact')).toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('shows empty state when no templates', () => {
      render(<TemplateSelector templates={[]} />)

      expect(screen.getByText(/No templates available/i)).toBeInTheDocument()
    })

    it('shows create button in empty state', () => {
      const mockOnCreate = jest.fn()
      render(<TemplateSelector templates={[]} allowCreate={true} onCreate={mockOnCreate} />)

      const createButton = screen.getByRole('button', { name: /create.*template/i })
      fireEvent.click(createButton)

      expect(mockOnCreate).toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    it('shows skeleton when loading', () => {
      render(<TemplateSelector templates={[]} isLoading={true} />)

      expect(screen.getByTestId('template-skeleton')).toBeInTheDocument()
    })

    it('hides templates when loading', () => {
      render(<TemplateSelector templates={mockTemplates} isLoading={true} />)

      expect(screen.queryByText('Service Confirmation')).not.toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('displays error message', () => {
      render(<TemplateSelector templates={[]} error="Failed to load templates" />)

      expect(screen.getByText(/Failed to load templates/i)).toBeInTheDocument()
    })

    it('shows retry button on error', () => {
      const mockOnRetry = jest.fn()
      render(
        <TemplateSelector templates={[]} error="Error" onRetry={mockOnRetry} />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalled()
    })
  })

  describe('Sorting', () => {
    it('sorts templates by name', () => {
      render(<TemplateSelector templates={mockTemplates} sortBy="name" />)

      const names = screen.getAllByTestId('template-name')
      expect(names[0]).toHaveTextContent('Promotion')
      expect(names[1]).toHaveTextContent('Review Request')
      expect(names[2]).toHaveTextContent('Service Confirmation')
    })

    it('sorts templates by category', () => {
      render(<TemplateSelector templates={mockTemplates} sortBy="category" />)

      const templates = screen.getAllByTestId('template-item')
      expect(templates[0]).toHaveTextContent('booking')
    })

    it('sorts templates by usage (most used first)', () => {
      const templatesWithUsage = mockTemplates.map((t, i) => ({
        ...t,
        usageCount: (3 - i) * 10, // 30, 20, 10
      }))

      render(
        <TemplateSelector templates={templatesWithUsage} sortBy="usage" showUsage={true} />
      )

      const usage = screen.getAllByText(/uses/i)
      expect(usage[0]).toHaveTextContent('30')
    })

    it('allows changing sort order', () => {
      render(<TemplateSelector templates={mockTemplates} allowSorting={true} />)

      const sortSelect = screen.getByRole('combobox', { name: /sort by/i })
      expect(sortSelect).toBeInTheDocument()

      fireEvent.change(sortSelect, { target: { value: 'name' } })
      expect(sortSelect).toHaveValue('name')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for templates', () => {
      render(<TemplateSelector templates={mockTemplates} />)

      expect(screen.getByLabelText(/Service Confirmation template/i)).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      render(<TemplateSelector templates={mockTemplates} />)

      const firstTemplate = screen.getByText('Service Confirmation')
      firstTemplate.focus()

      expect(firstTemplate).toHaveFocus()

      await user.keyboard('{ArrowDown}')

      const secondTemplate = screen.getByText('Review Request')
      expect(secondTemplate).toHaveFocus()
    })

    it('announces template selection to screen readers', () => {
      render(<TemplateSelector templates={mockTemplates} selectedId="template-1" />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveTextContent(/Service Confirmation selected/i)
    })

    it('has proper heading hierarchy', () => {
      render(<TemplateSelector templates={mockTemplates} />)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
    })
  })

  describe('Favorites', () => {
    it('shows favorite icon for favorited templates', () => {
      const templatesWithFavorites = mockTemplates.map((t, i) => ({
        ...t,
        isFavorite: i === 0,
      }))

      render(<TemplateSelector templates={templatesWithFavorites} showFavorites={true} />)

      expect(screen.getByTestId('favorite-icon-filled')).toBeInTheDocument()
    })

    it('allows toggling favorite status', () => {
      const mockOnToggleFavorite = jest.fn()
      render(
        <TemplateSelector
          templates={mockTemplates}
          showFavorites={true}
          onToggleFavorite={mockOnToggleFavorite}
        />
      )

      const favoriteButtons = screen.getAllByRole('button', { name: /favorite/i })
      fireEvent.click(favoriteButtons[0])

      expect(mockOnToggleFavorite).toHaveBeenCalledWith(mockTemplates[0].id, true)
    })

    it('filters to show only favorites', () => {
      const templatesWithFavorites = mockTemplates.map((t, i) => ({
        ...t,
        isFavorite: i === 0,
      }))

      render(
        <TemplateSelector
          templates={templatesWithFavorites}
          showFavorites={true}
          favoritesOnly={true}
        />
      )

      expect(screen.getByText('Service Confirmation')).toBeInTheDocument()
      expect(screen.queryByText('Review Request')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles templates with no variables', () => {
      const noVarTemplate = {
        id: 'no-var',
        name: 'Simple Template',
        body: 'This has no variables',
        variables: [],
      }

      render(<TemplateSelector templates={[noVarTemplate]} showVariables={true} />)

      expect(screen.getByText(/0 variables/i)).toBeInTheDocument()
    })

    it('handles very long template names', () => {
      const longNameTemplate = {
        ...mockTemplates[0],
        name: 'A'.repeat(100),
      }

      const { container } = render(<TemplateSelector templates={[longNameTemplate]} />)

      const nameElement = screen.getByText(/A{3,}/)
      expect(nameElement).toHaveClass('truncate')
    })

    it('handles missing template properties gracefully', () => {
      const minimalTemplate = {
        id: 'minimal',
        name: 'Minimal',
      }

      render(<TemplateSelector templates={[minimalTemplate]} />)

      expect(screen.getByText('Minimal')).toBeInTheDocument()
    })
  })
})
