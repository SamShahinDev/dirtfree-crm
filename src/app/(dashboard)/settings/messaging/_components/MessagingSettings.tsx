'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import {
  MessageSquare,
  Settings,
  Clock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

import {
  listTemplates,
  type TemplateData
} from '../actions'

import { TemplateEditor } from './TemplateEditor'
import { SampleDataForm } from './SampleDataForm'

export interface SampleData {
  customerName: string
  jobDate: string
  arrivalWindow: string
  company: string
}

export function MessagingSettings() {
  const [templates, setTemplates] = useState<TemplateData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [sampleData, setSampleData] = useState<SampleData>({
    customerName: 'John Smith',
    jobDate: '2024-03-15',
    arrivalWindow: '1-3 PM',
    company: 'Dirt Free Carpet'
  })

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const response = await listTemplates({})

      if (response.ok && response.data) {
        setTemplates(response.data.templates)
        // Auto-select first template if none selected
        if (!selectedTemplate && response.data.templates.length > 0) {
          setSelectedTemplate(response.data.templates[0].key)
        }
      } else {
        toast.error(response.error || 'Failed to load templates')
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [selectedTemplate])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleTemplateUpdated = () => {
    loadTemplates()
  }

  const selectedTemplateData = templates.find(t => t.key === selectedTemplate)

  const getTemplateDisplayName = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const getTemplateStats = () => {
    const total = templates.length
    const overridden = templates.filter(t => t.isOverridden).length
    const defaults = total - overridden

    return { total, overridden, defaults }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-lg">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-[400px] rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = getTemplateStats()

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Settings className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.overridden}</p>
                <p className="text-sm text-muted-foreground">Customized</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.defaults}</p>
                <p className="text-sm text-muted-foreground">Using Defaults</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Editor */}
      <Card className="rounded-lg">
        <CardHeader className="p-5 lg:p-6">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Template Editor
          </CardTitle>
          <CardDescription>
            Edit SMS templates with live preview and validation. Changes are automatically saved as overrides.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 lg:p-6 pt-0">
          <Tabs value={selectedTemplate || ''} onValueChange={setSelectedTemplate}>
            {/* Template Tabs */}
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
              {templates.map((template) => (
                <TabsTrigger
                  key={template.key}
                  value={template.key}
                  className="relative"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium">
                      {getTemplateDisplayName(template.key)}
                    </span>
                    <div className="flex items-center gap-1">
                      {template.isOverridden && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          Custom
                        </Badge>
                      )}
                      <Badge
                        variant={template.characterCount > 320 ? 'destructive' : 'outline'}
                        className="text-xs px-1 py-0"
                      >
                        {template.characterCount}
                      </Badge>
                    </div>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Template Content */}
            {templates.map((template) => (
              <TabsContent key={template.key} value={template.key} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Editor */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {getTemplateDisplayName(template.key)}
                      </h3>
                      <div className="flex items-center gap-2">
                        {template.isOverridden && (
                          <Badge variant="secondary" className="gap-1">
                            <Settings className="h-3 w-3" />
                            Customized
                          </Badge>
                        )}
                        {template.lastUpdated && (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(template.lastUpdated).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <TemplateEditor
                      template={template}
                      sampleData={sampleData}
                      onTemplateUpdated={handleTemplateUpdated}
                    />
                  </div>

                  {/* Sample Data & Validation */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Sample Data & Validation</h3>

                    <SampleDataForm
                      sampleData={sampleData}
                      onSampleDataChange={setSampleData}
                    />

                    {/* Validation Status */}
                    <Card className="rounded-lg">
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-3">Validation Status</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {template.characterCount <= 320 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm">
                              Character count: {template.characterCount}/320
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {template.body.toLowerCase().includes('reply stop to opt out') ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm">
                              Contains opt-out text
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {!/[^\x20-\x7E\s]/.test(template.body) ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm">
                              Plain text only
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Help */}
      <Card className="rounded-lg">
        <CardHeader className="p-5">
          <CardTitle className="text-base">Template Variables</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <code className="text-xs bg-muted px-2 py-1 rounded">{'{{customerName}}'}</code>
              <span className="ml-2 text-muted-foreground">Customer's name</span>
            </div>
            <div>
              <code className="text-xs bg-muted px-2 py-1 rounded">{'{{company}}'}</code>
              <span className="ml-2 text-muted-foreground">Company name</span>
            </div>
            <div>
              <code className="text-xs bg-muted px-2 py-1 rounded">{'{{jobDate}}'}</code>
              <span className="ml-2 text-muted-foreground">Formatted job date</span>
            </div>
            <div>
              <code className="text-xs bg-muted px-2 py-1 rounded">{'{{arrivalWindow}}'}</code>
              <span className="ml-2 text-muted-foreground">Time window</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}