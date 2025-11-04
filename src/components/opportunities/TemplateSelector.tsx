'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mail,
  MessageSquare,
  Phone,
  Gift,
  Lightbulb,
  Search,
  Copy,
  CheckCircle2,
  TrendingUp,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'

interface Template {
  id: string
  template_type: 'email' | 'sms' | 'script' | 'offer' | 'best_practice'
  opportunity_type: string | null
  title: string
  content: string
  variables: Record<string, string> | null
  success_rate: number | null
  usage_count: number
  category: string | null
  tags: string[] | null
  metadata: Record<string, any> | null
  is_public: boolean
}

interface TemplateSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunityType?: string
  onSelect: (content: string, variables?: Record<string, string>) => void
  filterType?: 'email' | 'sms' | 'script' | 'offer' | 'best_practice'
}

const TEMPLATE_TYPE_CONFIG = {
  email: {
    icon: Mail,
    label: 'Email Templates',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  sms: {
    icon: MessageSquare,
    label: 'SMS Templates',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  script: {
    icon: Phone,
    label: 'Phone Scripts',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  offer: {
    icon: Gift,
    label: 'Offer Templates',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  best_practice: {
    icon: Lightbulb,
    label: 'Best Practices',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
}

export default function TemplateSelector({
  open,
  onOpenChange,
  opportunityType,
  onSelect,
  filterType,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [activeTab, setActiveTab] = useState<string>(filterType || 'all')

  useEffect(() => {
    if (open) {
      loadTemplates()
    }
  }, [open, opportunityType])

  async function loadTemplates() {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (opportunityType) {
        params.append('opportunity_type', opportunityType)
      }
      if (filterType) {
        params.append('template_type', filterType)
      }

      const res = await fetch(`/api/opportunities/templates?${params}`)
      const data = await res.json()

      if (data.success) {
        setTemplates(data.data.templates)
      }
    } catch (error) {
      console.error('Load templates error:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  function substituteVariables(
    content: string,
    variables: Record<string, string> | null
  ): string {
    if (!variables) return content

    let result = content
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(regex, `[${variables[key]}]`)
    })
    return result
  }

  function handleTemplateSelect(template: Template) {
    setSelectedTemplate(template)
  }

  async function handleUseTemplate() {
    if (!selectedTemplate) return

    // Track usage
    try {
      await fetch('/api/opportunities/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id }),
      })
    } catch (error) {
      console.error('Track usage error:', error)
    }

    onSelect(selectedTemplate.content, selectedTemplate.variables || undefined)
    toast.success('Template inserted')
    onOpenChange(false)
    setSelectedTemplate(null)
  }

  function handleCopyTemplate() {
    if (!selectedTemplate) return

    navigator.clipboard.writeText(selectedTemplate.content)
    toast.success('Template copied to clipboard')
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !search ||
      template.title.toLowerCase().includes(search.toLowerCase()) ||
      template.content.toLowerCase().includes(search.toLowerCase()) ||
      template.tags?.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))

    const matchesTab =
      activeTab === 'all' || template.template_type === activeTab

    return matchesSearch && matchesTab
  })

  const templatesByType = filteredTemplates.reduce((acc, template) => {
    const type = template.template_type
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(template)
    return acc
  }, {} as Record<string, Template[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Template Library</DialogTitle>
          <DialogDescription>
            Choose from proven templates to maximize your opportunity conversions
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-6 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
              <TabsTrigger value="script">Scripts</TabsTrigger>
              <TabsTrigger value="offer">Offers</TabsTrigger>
              <TabsTrigger value="best_practice">Best Practices</TabsTrigger>
            </TabsList>

            <div className="grid grid-cols-2 gap-4 h-[500px]">
              {/* Template List */}
              <ScrollArea className="h-full border rounded-lg">
                <div className="p-4 space-y-2">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading templates...
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No templates found
                    </div>
                  ) : (
                    Object.entries(templatesByType).map(([type, typeTemplates]) => {
                      const config = TEMPLATE_TYPE_CONFIG[type as keyof typeof TEMPLATE_TYPE_CONFIG]
                      const Icon = config.icon

                      return (
                        <div key={type} className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mt-4 first:mt-0">
                            <Icon className={`h-4 w-4 ${config.color}`} />
                            {config.label}
                          </div>

                          {typeTemplates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => handleTemplateSelect(template)}
                              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                selectedTemplate?.id === template.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{template.title}</h4>
                                  {template.opportunity_type && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {template.opportunity_type.replace('_', ' ')}
                                    </Badge>
                                  )}
                                </div>

                                {template.success_rate && (
                                  <div className="flex items-center gap-1 text-xs text-green-600">
                                    <TrendingUp className="h-3 w-3" />
                                    {template.success_rate}%
                                  </div>
                                )}
                              </div>

                              {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {template.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {template.usage_count > 0 && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                  <Star className="h-3 w-3 fill-current" />
                                  Used {template.usage_count} times
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Template Preview */}
              <div className="border rounded-lg overflow-hidden flex flex-col">
                {selectedTemplate ? (
                  <>
                    <div className="p-4 border-b bg-muted/50">
                      <h3 className="font-semibold">{selectedTemplate.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedTemplate.opportunity_type && (
                          <Badge variant="outline">
                            {selectedTemplate.opportunity_type.replace('_', ' ')}
                          </Badge>
                        )}
                        {selectedTemplate.category && (
                          <Badge variant="secondary">{selectedTemplate.category}</Badge>
                        )}
                        {selectedTemplate.success_rate && (
                          <Badge variant="default" className="bg-green-600">
                            {selectedTemplate.success_rate}% success rate
                          </Badge>
                        )}
                      </div>

                      {selectedTemplate.metadata && (
                        <div className="mt-3 text-xs text-muted-foreground space-y-1">
                          {selectedTemplate.metadata.recommended_timing && (
                            <div>
                              <strong>Best Timing:</strong>{' '}
                              {selectedTemplate.metadata.recommended_timing}
                            </div>
                          )}
                          {selectedTemplate.metadata.tone && (
                            <div>
                              <strong>Tone:</strong> {selectedTemplate.metadata.tone}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <ScrollArea className="flex-1 p-4">
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm font-sans">
                          {substituteVariables(selectedTemplate.content, selectedTemplate.variables)}
                        </pre>
                      </div>

                      {selectedTemplate.variables &&
                        Object.keys(selectedTemplate.variables).length > 0 && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <h4 className="text-sm font-semibold mb-2">Available Variables:</h4>
                            <div className="space-y-1">
                              {Object.entries(selectedTemplate.variables).map(([key, description]) => (
                                <div key={key} className="text-xs">
                                  <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">
                                    {`{{${key}}}`}
                                  </code>
                                  <span className="text-muted-foreground ml-2">- {description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </ScrollArea>

                    <div className="p-4 border-t bg-muted/50 flex gap-2">
                      <Button onClick={handleCopyTemplate} variant="outline" className="flex-1">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button onClick={handleUseTemplate} className="flex-1">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a template to preview
                  </div>
                )}
              </div>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
