import { notFound } from 'next/navigation'
import { getSurveyByToken } from '@/lib/surveys/token'
import { SurveyCard } from './_components/SurveyCard'

interface SurveyPageProps {
  params: {
    token: string
  }
}

export default async function SurveyPage({ params }: SurveyPageProps) {
  const { token } = params

  // Validate token format
  if (!token || typeof token !== 'string' || token.length < 10) {
    notFound()
  }

  // Get survey data
  const survey = await getSurveyByToken(token)

  // If survey not found or invalid, show 404
  if (!survey) {
    notFound()
  }

  // If survey already completed, show completion message
  if (survey.status === 'responded') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Survey Already Completed
            </h1>
            <p className="text-gray-600 mb-6">
              Thank you for your feedback! This survey has already been completed.
            </p>
            <p className="text-sm text-gray-500">
              If you have additional feedback, please contact us directly.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show the survey form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SurveyCard survey={survey} token={token} />
      </div>
    </div>
  )
}

// Metadata for the page
export async function generateMetadata({ params }: SurveyPageProps) {
  const { token } = params

  // Basic validation
  if (!token || typeof token !== 'string') {
    return {
      title: 'Survey Not Found',
      description: 'The requested survey could not be found.'
    }
  }

  // Get survey data for metadata
  const survey = await getSurveyByToken(token)

  if (!survey) {
    return {
      title: 'Survey Not Found',
      description: 'The requested survey could not be found.'
    }
  }

  if (survey.status === 'responded') {
    return {
      title: 'Survey Completed - Dirt Free Carpet',
      description: 'This survey has already been completed. Thank you for your feedback!'
    }
  }

  return {
    title: 'Service Feedback - Dirt Free Carpet',
    description: `How was your service experience? We'd love to hear your feedback.`,
    robots: 'noindex, nofollow' // Don't index survey pages
  }
}

// Generate static params is not needed for dynamic routes like this
// but we can export dynamic configuration if needed
export const dynamic = 'force-dynamic' // Always render dynamically for fresh survey data