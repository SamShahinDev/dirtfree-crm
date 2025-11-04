'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mail,
  MessageSquare,
  Phone,
  Gift,
  Lightbulb,
  Search,
  Plus,
  TrendingUp,
  Star,
  BookOpen,
  Clock,
  Target,
  CheckCircle2,
  ArrowLeft,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import Link from 'next/link'

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

const TEMPLATE_TYPE_CONFIG = {
  email: {
    icon: Mail,
    label: 'Email Templates',
    description: 'Professional email templates for follow-ups and offers',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  sms: {
    icon: MessageSquare,
    label: 'SMS Templates',
    description: 'Short, effective text messages for quick follow-ups',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  script: {
    icon: Phone,
    label: 'Phone Scripts',
    description: 'Proven conversation scripts and objection handlers',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  offer: {
    icon: Gift,
    label: 'Offer Templates',
    description: 'Pre-configured offers and discount structures',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  best_practice: {
    icon: Lightbulb,
    label: 'Best Practices',
    description: 'Proven strategies and success stories from top performers',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
}

export default function TemplatesLibraryPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [grouped, setGrouped] = useState<Record<string, Template[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      setLoading(true)

      const res = await fetch('/api/opportunities/templates')
      const data = await res.json()

      if (data.success) {
        setTemplates(data.data.templates)
        setGrouped(data.data.grouped)
      }
    } catch (error) {
      console.error('Load templates error:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  function handleCopyTemplate(template: Template) {
    navigator.clipboard.writeText(template.content)
    toast.success('Template copied to clipboard')
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !search ||
      template.title.toLowerCase().includes(search.toLowerCase()) ||
      template.content.toLowerCase().includes(search.toLowerCase()) ||
      template.tags?.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))

    const matchesCategory =
      activeCategory === 'all' || template.template_type === activeCategory

    return matchesSearch && matchesCategory
  })

  // Statistics
  const stats = {
    totalTemplates: templates.length,
    emailTemplates: templates.filter((t) => t.template_type === 'email').length,
    smsTemplates: templates.filter((t) => t.template_type === 'sms').length,
    scripts: templates.filter((t) => t.template_type === 'script').length,
    offers: templates.filter((t) => t.template_type === 'offer').length,
    bestPractices: templates.filter((t) => t.template_type === 'best_practice').length,
    avgSuccessRate:
      templates
        .filter((t) => t.success_rate)
        .reduce((sum, t) => sum + (t.success_rate || 0), 0) /
        templates.filter((t) => t.success_rate).length || 0,
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/opportunities"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Opportunities
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900">
            <BookOpen className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Template Library</h1>
            <p className="text-muted-foreground mt-1">
              Proven templates and best practices to maximize conversions
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalTemplates}</div>
            <p className="text-xs text-muted-foreground">Total Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.emailTemplates}</div>
            <p className="text-xs text-muted-foreground">Email Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.smsTemplates}</div>
            <p className="text-xs text-muted-foreground">SMS Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.scripts}</div>
            <p className="text-xs text-muted-foreground">Phone Scripts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.offers}</div>
            <p className="text-xs text-muted-foreground">Offer Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avgSuccessRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Avg Success Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid grid-cols-6 mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="script">
            <Phone className="h-4 w-4 mr-2" />
            Scripts
          </TabsTrigger>
          <TabsTrigger value="offer">
            <Gift className="h-4 w-4 mr-2" />
            Offers
          </TabsTrigger>
          <TabsTrigger value="best_practice">
            <Lightbulb className="h-4 w-4 mr-2" />
            Best Practices
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">Loading templates...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template List */}
            <div className="space-y-4">
              {filteredTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No templates found</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(TEMPLATE_TYPE_CONFIG).map(([type, config]) => {
                  const typeTemplates = filteredTemplates.filter(
                    (t) => t.template_type === type
                  )

                  if (typeTemplates.length === 0) return null

                  const Icon = config.icon

                  return (
                    <div key={type} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <h2 className="text-lg font-semibold">{config.label}</h2>
                        <Badge variant="secondary">{typeTemplates.length}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{config.description}</p>

                      <div className="space-y-2">
                        {typeTemplates.map((template) => (
                          <Card
                            key={template.id}
                            className={`cursor-pointer transition-all ${
                              selectedTemplate?.id === template.id
                                ? 'border-primary shadow-md'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm">{template.title}</h4>
                                  {template.opportunity_type && (
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {template.opportunity_type.replace('_', ' ')}
                                    </Badge>
                                  )}
                                </div>

                                {template.success_rate && (
                                  <div className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                                    <TrendingUp className="h-3 w-3" />
                                    {template.success_rate}%
                                  </div>
                                )}
                              </div>

                              {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {template.tags.slice(0, 4).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                                {template.usage_count > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-current" />
                                    Used {template.usage_count} times
                                  </div>
                                )}
                                {template.metadata?.recommended_timing && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {template.metadata.recommended_timing}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Template Preview */}
            <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
              <Card className="h-full flex flex-col">
                {selectedTemplate ? (
                  <>
                    <CardHeader className="border-b">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{selectedTemplate.title}</CardTitle>
                          <CardDescription className="mt-2">
                            {TEMPLATE_TYPE_CONFIG[selectedTemplate.template_type].description}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {selectedTemplate.opportunity_type && (
                          <Badge variant="outline">
                            {selectedTemplate.opportunity_type.replace('_', ' ')}
                          </Badge>
                        )}
                        {selectedTemplate.category && (
                          <Badge variant="secondary">{selectedTemplate.category}</Badge>
                        )}
                        {selectedTemplate.success_rate && (
                          <Badge className="bg-green-600">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {selectedTemplate.success_rate}% success rate
                          </Badge>
                        )}
                      </div>

                      {selectedTemplate.metadata && (
                        <div className="mt-3 p-3 bg-muted rounded-lg space-y-2 text-sm">
                          {selectedTemplate.metadata.recommended_timing && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <strong>Best Timing:</strong>{' '}
                                {selectedTemplate.metadata.recommended_timing}
                              </div>
                            </div>
                          )}
                          {selectedTemplate.metadata.tone && (
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <strong>Tone:</strong> {selectedTemplate.metadata.tone}
                              </div>
                            </div>
                          )}
                          {selectedTemplate.metadata.expected_response_rate && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <strong>Expected Response:</strong>{' '}
                                {selectedTemplate.metadata.expected_response_rate}%
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="flex-1 overflow-hidden p-6">
                      <ScrollArea className="h-full">
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <pre className="whitespace-pre-wrap text-sm font-sans bg-muted p-4 rounded-lg">
                            {selectedTemplate.content}
                          </pre>
                        </div>

                        {selectedTemplate.variables &&
                          Object.keys(selectedTemplate.variables).length > 0 && (
                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Available Variables
                              </h4>
                              <div className="space-y-2">
                                {Object.entries(selectedTemplate.variables).map(
                                  ([key, description]) => (
                                    <div key={key} className="text-xs">
                                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded font-mono">
                                        {`{{${key}}}`}
                                      </code>
                                      <span className="text-muted-foreground ml-2">
                                        - {description}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </ScrollArea>
                    </CardContent>

                    <div className="p-4 border-t bg-muted/50">
                      <Button
                        onClick={() => handleCopyTemplate(selectedTemplate)}
                        className="w-full"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Template
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Select a template to view details
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  )
}
