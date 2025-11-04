'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  TestTube,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

interface Template {
  id: string
  category: string
  title: string
  templateText: string
  variables: string[]
  tags: string[]
  useCount: number
  lastUsedAt: string | null
  active: boolean
  createdAt: string
}

const CATEGORIES = [
  { value: 'billing', label: 'Billing' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'services', label: 'Services' },
  { value: 'complaints', label: 'Complaints' },
  { value: 'general', label: 'General' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'emergency', label: 'Emergency' },
]

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    category: 'general',
    title: '',
    templateText: '',
    variables: '',
    tags: '',
    active: true,
  })

  // Test states
  const [testVariables, setTestVariables] = useState<Record<string, string>>({})
  const [testPreview, setTestPreview] = useState('')

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      if (searchQuery) params.append('search', searchQuery)

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

  // Create template
  const createTemplate = async () => {
    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/messages/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formData.category,
          title: formData.title,
          templateText: formData.templateText,
          variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean),
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          active: formData.active,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to create template')
      }

      setSuccess('Template created successfully!')
      setTimeout(() => setSuccess(null), 3000)
      setCreateDialogOpen(false)
      setFormData({
        category: 'general',
        title: '',
        templateText: '',
        variables: '',
        tags: '',
        active: true,
      })
      fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
    }
  }

  // Update template
  const updateTemplate = async () => {
    if (!selectedTemplate) return

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/messages/templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formData.category,
          title: formData.title,
          templateText: formData.templateText,
          variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean),
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          active: formData.active,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to update template')
      }

      setSuccess('Template updated successfully!')
      setTimeout(() => setSuccess(null), 3000)
      setEditDialogOpen(false)
      setSelectedTemplate(null)
      fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template')
    }
  }

  // Delete template
  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/messages/templates/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to delete template')
      }

      setSuccess('Template deleted successfully!')
      setTimeout(() => setSuccess(null), 3000)
      fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }

  // Open edit dialog
  const openEditDialog = (template: Template) => {
    setSelectedTemplate(template)
    setFormData({
      category: template.category,
      title: template.title,
      templateText: template.templateText,
      variables: template.variables.join(', '),
      tags: template.tags.join(', '),
      active: template.active,
    })
    setEditDialogOpen(true)
  }

  // Open test dialog
  const openTestDialog = (template: Template) => {
    setSelectedTemplate(template)
    const initialVars: Record<string, string> = {}
    template.variables.forEach(v => {
      initialVars[v] = ''
    })
    setTestVariables(initialVars)
    setTestDialogOpen(true)
  }

  // Update test preview
  useEffect(() => {
    if (selectedTemplate && testDialogOpen) {
      let preview = selectedTemplate.templateText
      Object.entries(testVariables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g')
        preview = preview.replace(regex, value || `[${key}]`)
      })
      setTestPreview(preview)
    }
  }, [testVariables, selectedTemplate, testDialogOpen])

  // Load templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [categoryFilter, searchQuery])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Message Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage pre-written responses for quick communication
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchTemplates} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <Card>
            <CardContent className="text-center py-12">
              Loading templates...
            </CardContent>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              No templates found
            </CardContent>
          </Card>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{template.title}</CardTitle>
                      <Badge variant="outline">
                        {CATEGORIES.find(c => c.value === template.category)?.label}
                      </Badge>
                      {!template.active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <CardDescription className="whitespace-pre-wrap">
                      {template.templateText}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTestDialog(template)}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {template.variables.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4" />
                      {template.variables.length} variables
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Used {template.useCount} times
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a reusable message template with variable placeholders
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Active</Label>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                />
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Appointment Confirmation"
              />
            </div>

            <div>
              <Label>Template Text</Label>
              <Textarea
                value={formData.templateText}
                onChange={(e) => setFormData({...formData, templateText: e.target.value})}
                placeholder="Hi {customerName}, your appointment is on {appointmentDate}..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {'{variableName}'} for placeholders
              </p>
            </div>

            <div>
              <Label>Variables</Label>
              <Input
                value={formData.variables}
                onChange={(e) => setFormData({...formData, variables: e.target.value})}
                placeholder="customerName, appointmentDate, appointmentTime"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated list
              </p>
            </div>

            <div>
              <Label>Tags</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({...formData, tags: e.target.value})}
                placeholder="confirmation, reminder"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated list
              </p>
            </div>

            <Button onClick={createTemplate} className="w-full">
              Create Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the template details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Active</Label>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                />
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div>
              <Label>Template Text</Label>
              <Textarea
                value={formData.templateText}
                onChange={(e) => setFormData({...formData, templateText: e.target.value})}
                rows={6}
              />
            </div>

            <div>
              <Label>Variables</Label>
              <Input
                value={formData.variables}
                onChange={(e) => setFormData({...formData, variables: e.target.value})}
              />
            </div>

            <div>
              <Label>Tags</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({...formData, tags: e.target.value})}
              />
            </div>

            <Button onClick={updateTemplate} className="w-full">
              Update Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Template Dialog */}
      {selectedTemplate && (
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Test Template: {selectedTemplate.title}</DialogTitle>
              <DialogDescription>
                Fill in variables to preview the template
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedTemplate.variables.map((varName) => (
                <div key={varName}>
                  <Label>{varName}</Label>
                  <Input
                    value={testVariables[varName] || ''}
                    onChange={(e) => setTestVariables({...testVariables, [varName]: e.target.value})}
                    placeholder={`Enter ${varName}`}
                  />
                </div>
              ))}

              <div>
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Preview
                </Label>
                <div className="p-4 bg-muted rounded-lg mt-2">
                  <p className="text-sm whitespace-pre-wrap">{testPreview}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
