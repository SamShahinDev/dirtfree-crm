'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Search, Sparkles } from 'lucide-react'

/**
 * Message Template Selector Component
 *
 * Allows staff to search and select pre-written message templates
 * with variable substitution for quick responses.
 *
 * Usage:
 * <TemplateSelector
 *   onSelect={(template, substitutedText) => {
 *     setMessageText(substitutedText)
 *   }}
 *   variables={{
 *     customerName: "John Smith",
 *     appointmentDate: "2025-01-25",
 *     ...
 *   }}
 * />
 */

export interface MessageTemplate {
  id: string
  category: string
  title: string
  templateText: string
  variables: string[]
  tags: string[]
  useCount: number
  lastUsedAt: string | null
}

export interface TemplateSelectorProps {
  onSelect: (template: MessageTemplate, substitutedText: string) => void
  variables?: Record<string, string>
  defaultCategory?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: 'Billing',
  scheduling: 'Scheduling',
  services: 'Services',
  complaints: 'Complaints',
  general: 'General',
  follow_up: 'Follow-up',
  emergency: 'Emergency',
}

export function TemplateSelector({
  onSelect,
  variables = {},
  defaultCategory,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>(defaultCategory || 'all')

  // Selected template for preview
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [previewText, setPreviewText] = useState('')

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter)
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const response = await fetch(`/api/messages/templates?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch templates')
      }

      setTemplates(data.data.templates || [])
      setFilteredTemplates(data.data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  // Substitute variables in template
  const substituteVariables = (
    templateText: string,
    vars: Record<string, string>
  ): string => {
    let result = templateText

    // Replace all {variable} placeholders
    Object.entries(vars).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g')
      result = result.replace(regex, value || `[${key}]`)
    })

    // Clean up any remaining unreplaced variables
    result = result.replace(/\{([^}]+)\}/g, '[$1]')

    return result
  }

  // Handle template selection
  const handleSelectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template)

    // Initialize variable values with provided variables or empty strings
    const initialValues: Record<string, string> = {}
    template.variables.forEach((varName) => {
      initialValues[varName] = variables[varName] || ''
    })
    setVariableValues(initialValues)

    // Generate preview
    const preview = substituteVariables(template.templateText, {
      ...variables,
      ...initialValues,
    })
    setPreviewText(preview)
  }

  // Update preview when variable values change
  useEffect(() => {
    if (selectedTemplate) {
      const preview = substituteVariables(selectedTemplate.templateText, {
        ...variables,
        ...variableValues,
      })
      setPreviewText(preview)
    }
  }, [variableValues, selectedTemplate, variables])

  // Handle insert
  const handleInsert = async () => {
    if (!selectedTemplate) return

    const finalText = substituteVariables(selectedTemplate.templateText, {
      ...variables,
      ...variableValues,
    })

    // Increment usage counter
    try {
      await fetch(`/api/messages/templates/${selectedTemplate.id}`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('Failed to increment usage:', err)
    }

    onSelect(selectedTemplate, finalText)
    setOpen(false)
    setSelectedTemplate(null)
    setVariableValues({})
  }

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open, categoryFilter, searchQuery])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Message Templates</DialogTitle>
          <DialogDescription>
            Select a pre-written template and customize variables
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Template List */}
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template List */}
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading templates...
                </div>
              ) : error ? (
                <div className="text-center py-8 text-destructive">
                  {error}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No templates found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                        selectedTemplate?.id === template.id ? 'bg-muted border-primary' : ''
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium">{template.title}</div>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[template.category]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.templateText}
                      </p>
                      {template.useCount > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Used {template.useCount} times
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Preview and Variables */}
          <div className="space-y-4">
            {selectedTemplate ? (
              <>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">
                    Variables
                  </Label>
                  {selectedTemplate.variables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No variables to customize
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTemplate.variables.map((varName) => (
                        <div key={varName}>
                          <Label className="text-xs text-muted-foreground">
                            {varName}
                          </Label>
                          <Input
                            value={variableValues[varName] || ''}
                            onChange={(e) =>
                              setVariableValues({
                                ...variableValues,
                                [varName]: e.target.value,
                              })
                            }
                            placeholder={`Enter ${varName}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Preview
                  </Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{previewText}</p>
                  </div>
                </div>

                <Button onClick={handleInsert} className="w-full">
                  Insert Template
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">Select a template to preview</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
