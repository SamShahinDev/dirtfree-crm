'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { submitFeedback } from '../actions'

interface FeedbackDrawerProps {
  open: boolean
  onClose: () => void
}

const feedbackTypes = [
  { id: 'bug', label: 'Bug Report', description: 'Something is broken or not working correctly' },
  { id: 'feature', label: 'Feature Request', description: 'Suggest a new feature or improvement' },
  { id: 'documentation', label: 'Documentation', description: 'Feedback about training guides or help content' },
  { id: 'general', label: 'General Feedback', description: 'Any other feedback or suggestions' },
]

const priorityLevels = [
  { id: 'low', label: 'Low', description: 'Minor issue or suggestion' },
  { id: 'medium', label: 'Medium', description: 'Moderate impact on work' },
  { id: 'high', label: 'High', description: 'Significant impact on productivity' },
  { id: 'critical', label: 'Critical', description: 'Blocking work or urgent issue' },
]

export function FeedbackDrawer({ open, onClose }: FeedbackDrawerProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    type: 'general',
    priority: 'medium',
    subject: '',
    description: '',
    steps: '',
    email: '',
    name: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await submitFeedback(formData)
      setSubmitted(true)
      setTimeout(() => {
        onClose()
        setSubmitted(false)
        setFormData({
          type: 'general',
          priority: 'medium',
          subject: '',
          description: '',
          steps: '',
          email: '',
          name: ''
        })
      }, 2000)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-xl">
                    <div className="flex-1 overflow-y-auto">
                      {/* Header */}
                      <div className="bg-blue-600 px-4 py-6 sm:px-6">
                        <div className="flex items-center justify-between">
                          <Dialog.Title className="text-base font-semibold leading-6 text-white">
                            Send Feedback
                          </Dialog.Title>
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="relative rounded-md bg-blue-600 text-blue-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                              onClick={onClose}
                            >
                              <span className="absolute -inset-2.5" />
                              <span className="sr-only">Close panel</span>
                              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-blue-200">
                            Help us improve by sharing your feedback, suggestions, or reporting issues.
                          </p>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="px-4 py-6 sm:px-6">
                        {submitted ? (
                          <div className="text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                              <PaperAirplaneIcon className="h-6 w-6 text-green-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Feedback Submitted!
                            </h3>
                            <p className="text-sm text-gray-600">
                              Thank you for your feedback. We'll review it and get back to you if needed.
                            </p>
                          </div>
                        ) : (
                          <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Contact Information */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-gray-900">Contact Information</h3>
                              <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                  Name
                                </label>
                                <input
                                  type="text"
                                  id="name"
                                  value={formData.name}
                                  onChange={(e) => handleChange('name', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  placeholder="Your name"
                                />
                              </div>
                              <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  id="email"
                                  value={formData.email}
                                  onChange={(e) => handleChange('email', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  placeholder="your.email@company.com"
                                />
                              </div>
                            </div>

                            {/* Feedback Type */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-3">
                                Feedback Type
                              </label>
                              <div className="space-y-2">
                                {feedbackTypes.map((type) => (
                                  <label key={type.id} className="flex items-start cursor-pointer">
                                    <input
                                      type="radio"
                                      name="type"
                                      value={type.id}
                                      checked={formData.type === type.id}
                                      onChange={(e) => handleChange('type', e.target.value)}
                                      className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="ml-3">
                                      <div className="text-sm font-medium text-gray-900">{type.label}</div>
                                      <div className="text-xs text-gray-500">{type.description}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Priority Level */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-3">
                                Priority Level
                              </label>
                              <div className="space-y-2">
                                {priorityLevels.map((priority) => (
                                  <label key={priority.id} className="flex items-start cursor-pointer">
                                    <input
                                      type="radio"
                                      name="priority"
                                      value={priority.id}
                                      checked={formData.priority === priority.id}
                                      onChange={(e) => handleChange('priority', e.target.value)}
                                      className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="ml-3">
                                      <div className="text-sm font-medium text-gray-900">{priority.label}</div>
                                      <div className="text-xs text-gray-500">{priority.description}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Subject */}
                            <div>
                              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                                Subject <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                id="subject"
                                required
                                value={formData.subject}
                                onChange={(e) => handleChange('subject', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                placeholder="Brief summary of your feedback"
                              />
                            </div>

                            {/* Description */}
                            <div>
                              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                Description <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                id="description"
                                required
                                rows={4}
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                placeholder="Detailed description of your feedback, suggestion, or issue"
                              />
                            </div>

                            {/* Steps to Reproduce (for bugs) */}
                            {formData.type === 'bug' && (
                              <div>
                                <label htmlFor="steps" className="block text-sm font-medium text-gray-700">
                                  Steps to Reproduce
                                </label>
                                <textarea
                                  id="steps"
                                  rows={3}
                                  value={formData.steps}
                                  onChange={(e) => handleChange('steps', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  placeholder="1. Go to...&#10;2. Click on...&#10;3. Notice that..."
                                />
                              </div>
                            )}

                            {/* Submit Button */}
                            <div className="flex justify-end pt-4">
                              <button
                                type="submit"
                                disabled={submitting || !formData.subject || !formData.description}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {submitting ? (
                                  <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Submitting...
                                  </>
                                ) : (
                                  <>
                                    <PaperAirplaneIcon className="h-4 w-4" />
                                    Submit Feedback
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}