/**
 * Review Request Job Processor
 */

export async function sendReviewRequest(payload: {
  jobId: string
  customerId: string
}) {
  console.log(`Sending review request for job ${payload.jobId} to customer ${payload.customerId}`)
  // TODO: Implement review request email
}
