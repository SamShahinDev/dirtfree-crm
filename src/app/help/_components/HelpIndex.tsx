'use client'

import { useState } from 'react'
import { BookOpenIcon, UserGroupIcon, WrenchScrewdriverIcon, QuestionMarkCircleIcon, ExclamationTriangleIcon, DocumentTextIcon, PrinterIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { FeedbackDrawer } from './FeedbackDrawer'

interface HelpSection {
  id: string
  title: string
  description: string
  icon: any
  items: HelpItem[]
  color: string
}

interface HelpItem {
  title: string
  description: string
  href: string
  badge?: string
}

const helpSections: HelpSection[] = [
  {
    id: 'training',
    title: 'Training Guides',
    description: 'Role-specific training materials and day-1 onboarding',
    icon: UserGroupIcon,
    color: 'bg-blue-500',
    items: [
      {
        title: 'Administrator Training',
        description: 'Complete admin guide including user management, system configuration, and security',
        href: '/docs/training-admin.md',
        badge: 'Admin'
      },
      {
        title: 'Dispatcher Training',
        description: 'Customer management, job coordination, scheduling, and communication workflows',
        href: '/docs/training-dispatcher.md',
        badge: 'Dispatcher'
      },
      {
        title: 'Technician Training',
        description: 'Mobile app usage, job management, photo documentation, and field procedures',
        href: '/docs/training-technician.md',
        badge: 'Technician'
      }
    ]
  },
  {
    id: 'operations',
    title: 'Operations Runbooks',
    description: 'Incident response, release management, and operational procedures',
    icon: WrenchScrewdriverIcon,
    color: 'bg-red-500',
    items: [
      {
        title: 'Incident Response',
        description: 'Severity classification, escalation procedures, and crisis management',
        href: '/docs/runbook-incident-response.md',
        badge: 'Critical'
      },
      {
        title: 'Release Management',
        description: 'Deployment procedures, rollback plans, and version control',
        href: '/docs/runbook-release.md',
        badge: 'Operations'
      }
    ]
  },
  {
    id: 'support',
    title: 'Support Resources',
    description: 'FAQ, troubleshooting, and known issues',
    icon: QuestionMarkCircleIcon,
    color: 'bg-green-500',
    items: [
      {
        title: 'Frequently Asked Questions',
        description: 'Common questions about login, roles, SMS, scheduling, and troubleshooting',
        href: '/docs/faq.md'
      },
      {
        title: 'Known Issues',
        description: 'Current system issues, workarounds, and resolution status',
        href: '/docs/known-issues.md',
        badge: 'Updated Weekly'
      }
    ]
  },
  {
    id: 'testing',
    title: 'Quality Assurance',
    description: 'UAT checklists and testing procedures',
    icon: DocumentTextIcon,
    color: 'bg-purple-500',
    items: [
      {
        title: 'UAT Checklist',
        description: 'Comprehensive user acceptance testing scenarios and validation criteria',
        href: '/docs/uat-checklist.md',
        badge: 'Testing'
      }
    ]
  }
]

export function HelpIndex() {
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const handlePrintAll = () => {
    const printContent = helpSections.map(section =>
      section.items.map(item => `- [${item.title}](${item.href})`).join('\n')
    ).join('\n\n')

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Dirt Free CRM - Help Center Documentation</title>
            <link rel="stylesheet" href="/help/print.css">
          </head>
          <body>
            <h1>Dirt Free CRM - Help Center</h1>
            <p>Complete documentation package - Generated on ${new Date().toLocaleDateString()}</p>
            <h2>Available Documentation:</h2>
            <pre>${printContent}</pre>
            <p><em>Visit each link in the browser to view and print individual documents.</em></p>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const openDocument = (href: string) => {
    // Open markdown files in new tab for viewing
    window.open(href, '_blank')
  }

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleDateString()} | Version 1.0
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrintAll}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PrinterIcon className="h-4 w-4" />
            Print Package
          </button>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            Send Feedback
          </button>
        </div>
      </div>

      {/* Help Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {helpSections.map((section) => (
          <div key={section.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${section.color}`}>
                  <section.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openDocument(item.href)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      {item.badge && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => openDocument('/docs/faq.md')}
            className="p-4 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <QuestionMarkCircleIcon className="h-8 w-8 text-blue-500 mb-2" />
            <div className="font-medium text-gray-900">FAQ</div>
            <div className="text-sm text-gray-600">Quick answers</div>
          </button>

          <button
            onClick={() => openDocument('/docs/known-issues.md')}
            className="p-4 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500 mb-2" />
            <div className="font-medium text-gray-900">Known Issues</div>
            <div className="text-sm text-gray-600">Current problems</div>
          </button>

          <button
            onClick={() => openDocument('/docs/uat-checklist.md')}
            className="p-4 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <DocumentTextIcon className="h-8 w-8 text-green-500 mb-2" />
            <div className="font-medium text-gray-900">UAT Testing</div>
            <div className="text-sm text-gray-600">Validation checklist</div>
          </button>

          <button
            onClick={() => setFeedbackOpen(true)}
            className="p-4 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-500 mb-2" />
            <div className="font-medium text-gray-900">Send Feedback</div>
            <div className="text-sm text-gray-600">Suggest improvements</div>
          </button>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-4">Emergency Contacts</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-red-900">System Administrator</div>
            <div className="text-red-700">admin@acme.test</div>
            <div className="text-red-700">[REDACTED]</div>
          </div>
          <div>
            <div className="font-medium text-red-900">Technical Support</div>
            <div className="text-red-700">support@acme.test</div>
            <div className="text-red-700">Business hours</div>
          </div>
          <div>
            <div className="font-medium text-red-900">On-Call Emergency</div>
            <div className="text-red-700">[EMERGENCY_NUMBER]</div>
            <div className="text-red-700">24/7 for critical issues</div>
          </div>
        </div>
      </div>

      {/* Feedback Drawer */}
      <FeedbackDrawer
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  )
}