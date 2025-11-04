/**
 * CSRF Token Generation Endpoint
 *
 * Generates and returns a CSRF token for client use.
 * Clients should fetch this token and include it in subsequent requests.
 */

import { createCsrfTokenEndpoint } from '@/lib/security/csrf'

export const GET = createCsrfTokenEndpoint()

export const dynamic = 'force-dynamic'
