import { describe, it, expect } from '@jest/globals'
import { createSuccessResponse, createErrorResponse } from '@/lib/test-utils'

/**
 * API Response Helpers Tests
 *
 * Tests for API response formatting utilities
 */

describe('API Response Helpers', () => {
  describe('Success Response', () => {
    it('should create a success response with data', () => {
      const data = { id: '123', name: 'Test User' }
      const response = createSuccessResponse(data)

      expect(response.success).toBe(true)
      expect(response.data).toEqual(data)
      expect(response.version).toBe('v1')
      expect(response.timestamp).toBeDefined()
    })

    it('should create a success response with array data', () => {
      const data = [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' },
      ]
      const response = createSuccessResponse(data)

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(2)
      expect(Array.isArray(response.data)).toBe(true)
    })

    it('should create a success response with null data', () => {
      const data = null
      const response = createSuccessResponse(data)

      expect(response.success).toBe(true)
      expect(response.data).toBeNull()
    })

    it('should have valid ISO timestamp', () => {
      const data = { test: 'data' }
      const response = createSuccessResponse(data)

      const timestamp = new Date(response.timestamp)
      expect(timestamp.toString()).not.toBe('Invalid Date')
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('Error Response', () => {
    it('should create an error response with default status', () => {
      const error = 'validation_error'
      const message = 'Invalid input data'
      const response = createErrorResponse(error, message)

      expect(response.success).toBe(false)
      expect(response.error).toBe(error)
      expect(response.message).toBe(message)
      expect(response.status).toBe(500)
      expect(response.version).toBe('v1')
    })

    it('should create an error response with custom status', () => {
      const error = 'not_found'
      const message = 'Resource not found'
      const status = 404
      const response = createErrorResponse(error, message, status)

      expect(response.success).toBe(false)
      expect(response.error).toBe(error)
      expect(response.message).toBe(message)
      expect(response.status).toBe(404)
    })

    it('should handle 401 unauthorized errors', () => {
      const error = 'unauthorized'
      const message = 'Authentication required'
      const status = 401
      const response = createErrorResponse(error, message, status)

      expect(response.status).toBe(401)
      expect(response.error).toBe('unauthorized')
    })

    it('should handle 403 forbidden errors', () => {
      const error = 'forbidden'
      const message = 'Insufficient permissions'
      const status = 403
      const response = createErrorResponse(error, message, status)

      expect(response.status).toBe(403)
      expect(response.error).toBe('forbidden')
    })

    it('should handle 400 bad request errors', () => {
      const error = 'bad_request'
      const message = 'Invalid request parameters'
      const status = 400
      const response = createErrorResponse(error, message, status)

      expect(response.status).toBe(400)
      expect(response.error).toBe('bad_request')
    })
  })

  describe('Response Validation', () => {
    it('should validate success response structure', () => {
      const data = { test: 'data' }
      const response = createSuccessResponse(data)

      // Check required fields
      expect(response).toHaveProperty('success')
      expect(response).toHaveProperty('data')
      expect(response).toHaveProperty('version')
      expect(response).toHaveProperty('timestamp')

      // Check types
      expect(typeof response.success).toBe('boolean')
      expect(typeof response.version).toBe('string')
      expect(typeof response.timestamp).toBe('string')
    })

    it('should validate error response structure', () => {
      const response = createErrorResponse('test_error', 'Test message', 400)

      // Check required fields
      expect(response).toHaveProperty('success')
      expect(response).toHaveProperty('error')
      expect(response).toHaveProperty('message')
      expect(response).toHaveProperty('status')
      expect(response).toHaveProperty('version')

      // Check types
      expect(typeof response.success).toBe('boolean')
      expect(typeof response.error).toBe('string')
      expect(typeof response.message).toBe('string')
      expect(typeof response.status).toBe('number')
      expect(typeof response.version).toBe('string')
    })

    it('should have consistent version across responses', () => {
      const successResponse = createSuccessResponse({ test: 'data' })
      const errorResponse = createErrorResponse('error', 'message', 500)

      expect(successResponse.version).toBe(errorResponse.version)
      expect(successResponse.version).toBe('v1')
    })
  })

  describe('Complex Data Types', () => {
    it('should handle nested object data', () => {
      const data = {
        user: {
          id: '123',
          profile: {
            name: 'Test User',
            email: 'test@example.com',
          },
        },
        metadata: {
          created_at: '2024-01-01',
          updated_at: '2024-12-01',
        },
      }
      const response = createSuccessResponse(data)

      expect(response.data).toEqual(data)
      expect(response.data.user.profile.name).toBe('Test User')
    })

    it('should handle array of objects', () => {
      const data = [
        { id: '1', status: 'active' },
        { id: '2', status: 'inactive' },
        { id: '3', status: 'pending' },
      ]
      const response = createSuccessResponse(data)

      expect(response.data).toHaveLength(3)
      expect(response.data[0].status).toBe('active')
      expect(response.data[2].status).toBe('pending')
    })

    it('should handle pagination metadata', () => {
      const data = {
        items: [{ id: '1' }, { id: '2' }],
        pagination: {
          total: 100,
          page: 1,
          per_page: 10,
          total_pages: 10,
        },
      }
      const response = createSuccessResponse(data)

      expect(response.data.pagination.total).toBe(100)
      expect(response.data.items).toHaveLength(2)
    })
  })
})
