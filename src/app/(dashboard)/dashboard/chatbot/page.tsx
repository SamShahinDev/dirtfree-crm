'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Bot,
  Brain,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  TestTube,
  Save,
  RefreshCw,
  Send,
} from 'lucide-react'

/**
 * Chatbot Configuration & Training Dashboard
 *
 * Features:
 * - View analytics (interactions, confidence, intents, escalation)
 * - Configure responses and thresholds
 * - Test chatbot live
 */

interface IntentConfig {
  id: string
  intent: string
  displayName: string
  responseTemplates: string[]
  confidenceThreshold: number
  autoEscalateBelow: number
  requiresEscalation: boolean
  keywords: string[]
  phrases: string[]
  followUpQuestions: string[]
}

interface Analytics {
  period: {
    start: string
    end: string
  }
  summary: {
    totalSessions: number
    totalInteractions: number
    escalationRate: number
    avgConfidenceScore: number
    avgSessionLength: string
    avgResponseTime: number
  }
  intents: {
    topIntents: Array<{ intent_detected: string; intent_count: number }>
    distribution: Record<string, Record<string, number>>
  }
  confidence: {
    distribution: Record<string, number>
    average: number
  }
  satisfaction: {
    average: number
    count: number
    distribution: Record<number, number>
  }
  escalations: {
    rate: number
    recent: Array<{
      timestamp: string
      intent: string
      reason: string
      isUrgent: boolean
    }>
  }
}

interface TestResult {
  input: {
    message: string
    customerId: string | null
    sessionId: string
  }
  intentDetection: {
    intent: string
    confidence: number
    confidencePercentage: string
    matchedKeywords: string[]
    shouldEscalate: boolean
    escalationReason?: string
    isUrgent: boolean
  }
  response: {
    text: string
    shouldEscalate: boolean
    followUpQuestions?: string[]
  }
  context: Record<string, any>
  conversationHistory: Array<{
    role: string
    content: string
    timestamp: string
    intent?: string
    confidence?: number
  }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function ChatbotDashboard() {
  const [activeTab, setActiveTab] = useState('analytics')
  const [configs, setConfigs] = useState<IntentConfig[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Test interface state
  const [testMessage, setTestMessage] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)

  // Fetch configurations
  const fetchConfigs = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/chatbot/config')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch configurations')
      }

      setConfigs(data.data)
      if (data.data.length > 0 && !selectedIntent) {
        setSelectedIntent(data.data[0].intent)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configurations')
    } finally {
      setLoading(false)
    }
  }

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/chatbot/analytics')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch analytics')
      }

      setAnalytics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  // Save configuration
  const saveConfig = async () => {
    if (!selectedIntent) return

    const config = configs.find((c) => c.intent === selectedIntent)
    if (!config) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/chatbot/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: config.intent,
          responseTemplates: config.responseTemplates,
          confidenceThreshold: config.confidenceThreshold,
          autoEscalateBelow: config.autoEscalateBelow,
          requiresEscalation: config.requiresEscalation,
          keywords: config.keywords,
          phrases: config.phrases,
          followUpQuestions: config.followUpQuestions,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to save configuration')
      }

      setSuccess('Configuration saved successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  // Test chatbot
  const testChatbot = async () => {
    if (!testMessage.trim()) return

    try {
      setTesting(true)
      setError(null)

      const response = await fetch('/api/chatbot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testMessage,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Test failed')
      }

      setTestResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  // Update config field
  const updateConfig = (intent: string, field: keyof IntentConfig, value: any) => {
    setConfigs((prev) =>
      prev.map((c) => (c.intent === intent ? { ...c, [field]: value } : c))
    )
  }

  // Load data on mount
  useEffect(() => {
    fetchConfigs()
    fetchAnalytics()
  }, [])

  const selectedConfig = configs.find((c) => c.intent === selectedIntent)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8" />
            Chatbot Training & Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage AI chatbot responses, view analytics, and test performance
          </p>
        </div>
        <Button onClick={() => { fetchConfigs(); fetchAnalytics(); }} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="testing">
            <TestTube className="h-4 w-4 mr-2" />
            Testing
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {loading && !analytics ? (
            <div className="text-center py-12">Loading analytics...</div>
          ) : analytics ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.totalSessions}</div>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.totalInteractions}</div>
                    <p className="text-xs text-muted-foreground">Messages processed</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(analytics.summary.avgConfidenceScore * 100)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Intent detection</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Escalation Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.summary.escalationRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">To human support</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Intents */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Intents</CardTitle>
                    <CardDescription>Most frequently detected intents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.intents.topIntents}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="intent_detected" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="intent_count" fill="#0088FE" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Confidence Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Confidence Distribution</CardTitle>
                    <CardDescription>Intent detection confidence levels</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(analytics.confidence.distribution).map(
                            ([range, count]) => ({ name: range, value: count })
                          )}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(analytics.confidence.distribution).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Satisfaction Ratings */}
                {analytics.satisfaction.count > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Customer Satisfaction</CardTitle>
                      <CardDescription>
                        Average: {analytics.satisfaction.average.toFixed(1)}/5 ({analytics.satisfaction.count} ratings)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={Object.entries(analytics.satisfaction.distribution).map(
                            ([rating, count]) => ({ rating: `${rating} stars`, count })
                          )}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="rating" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#00C49F" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Escalations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Escalations</CardTitle>
                    <CardDescription>Latest conversations escalated to humans</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analytics.escalations.recent.map((escalation, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <div className="font-medium">{escalation.intent}</div>
                            <div className="text-sm text-muted-foreground">{escalation.reason}</div>
                          </div>
                          {escalation.isUrgent && (
                            <Badge variant="destructive">Urgent</Badge>
                          )}
                        </div>
                      ))}
                      {analytics.escalations.recent.length === 0 && (
                        <div className="text-center text-muted-foreground py-4">
                          No recent escalations
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Intent List */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Intents</CardTitle>
                <CardDescription>Select an intent to configure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {configs.map((config) => (
                  <Button
                    key={config.intent}
                    variant={selectedIntent === config.intent ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setSelectedIntent(config.intent)}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    {config.displayName}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Configuration Form */}
            {selectedConfig && (
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle>{selectedConfig.displayName}</CardTitle>
                  <CardDescription>Configure responses and thresholds</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Response Templates */}
                  <div className="space-y-2">
                    <Label>Response Templates</Label>
                    {selectedConfig.responseTemplates.map((template, idx) => (
                      <Textarea
                        key={idx}
                        value={template}
                        onChange={(e) => {
                          const newTemplates = [...selectedConfig.responseTemplates]
                          newTemplates[idx] = e.target.value
                          updateConfig(selectedConfig.intent, 'responseTemplates', newTemplates)
                        }}
                        rows={3}
                        className="font-mono text-sm"
                      />
                    ))}
                  </div>

                  {/* Thresholds */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Confidence Threshold</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedConfig.confidenceThreshold}
                        onChange={(e) =>
                          updateConfig(
                            selectedConfig.intent,
                            'confidenceThreshold',
                            parseFloat(e.target.value)
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum confidence to use this intent
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Auto-Escalate Below</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedConfig.autoEscalateBelow}
                        onChange={(e) =>
                          updateConfig(
                            selectedConfig.intent,
                            'autoEscalateBelow',
                            parseFloat(e.target.value)
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Escalate if confidence is below this
                      </p>
                    </div>
                  </div>

                  {/* Requires Escalation */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={selectedConfig.requiresEscalation}
                      onCheckedChange={(checked) =>
                        updateConfig(selectedConfig.intent, 'requiresEscalation', checked)
                      }
                    />
                    <Label>Always escalate to human</Label>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-2">
                    <Label>Keywords</Label>
                    <Input
                      value={selectedConfig.keywords.join(', ')}
                      onChange={(e) =>
                        updateConfig(
                          selectedConfig.intent,
                          'keywords',
                          e.target.value.split(',').map((k) => k.trim())
                        )
                      }
                      placeholder="keyword1, keyword2, keyword3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of keywords
                    </p>
                  </div>

                  {/* Phrases */}
                  <div className="space-y-2">
                    <Label>Phrases</Label>
                    <Textarea
                      value={selectedConfig.phrases.join('\n')}
                      onChange={(e) =>
                        updateConfig(
                          selectedConfig.intent,
                          'phrases',
                          e.target.value.split('\n').filter((p) => p.trim())
                        )
                      }
                      rows={4}
                      placeholder="One phrase per line"
                    />
                    <p className="text-xs text-muted-foreground">
                      One phrase per line (higher weight than keywords)
                    </p>
                  </div>

                  {/* Follow-up Questions */}
                  <div className="space-y-2">
                    <Label>Follow-up Questions</Label>
                    <Textarea
                      value={selectedConfig.followUpQuestions.join('\n')}
                      onChange={(e) =>
                        updateConfig(
                          selectedConfig.intent,
                          'followUpQuestions',
                          e.target.value.split('\n').filter((q) => q.trim())
                        )
                      }
                      rows={3}
                      placeholder="One question per line"
                    />
                  </div>

                  {/* Save Button */}
                  <Button onClick={saveConfig} disabled={saving} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Test Input */}
            <Card>
              <CardHeader>
                <CardTitle>Test Chatbot</CardTitle>
                <CardDescription>Send a test message to see how the bot responds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Test Message</Label>
                  <Textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Type a test message..."
                    rows={4}
                  />
                </div>
                <Button onClick={testChatbot} disabled={testing || !testMessage.trim()} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  {testing ? 'Testing...' : 'Send Test Message'}
                </Button>
              </CardContent>
            </Card>

            {/* Test Results */}
            {testResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                  <CardDescription>Intent detection and response generation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Intent Detection */}
                  <div>
                    <Label className="text-sm font-semibold">Detected Intent</Label>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline">{testResult.intentDetection.intent}</Badge>
                      <span className="text-sm font-medium">
                        {testResult.intentDetection.confidencePercentage} confidence
                      </span>
                    </div>
                  </div>

                  {/* Matched Keywords */}
                  {testResult.intentDetection.matchedKeywords.length > 0 && (
                    <div>
                      <Label className="text-sm font-semibold">Matched Keywords</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {testResult.intentDetection.matchedKeywords.map((keyword, idx) => (
                          <Badge key={idx} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Escalation */}
                  {testResult.intentDetection.shouldEscalate && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Would escalate to human
                        {testResult.intentDetection.escalationReason && `: ${testResult.intentDetection.escalationReason}`}
                        {testResult.intentDetection.isUrgent && ' (URGENT)'}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Response */}
                  <div>
                    <Label className="text-sm font-semibold">Generated Response</Label>
                    <div className="mt-2 p-4 bg-muted rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{testResult.response.text}</p>
                    </div>
                  </div>

                  {/* Follow-up Questions */}
                  {testResult.response.followUpQuestions && testResult.response.followUpQuestions.length > 0 && (
                    <div>
                      <Label className="text-sm font-semibold">Follow-up Questions</Label>
                      <ul className="mt-2 space-y-1">
                        {testResult.response.followUpQuestions.map((question, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground">• {question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
