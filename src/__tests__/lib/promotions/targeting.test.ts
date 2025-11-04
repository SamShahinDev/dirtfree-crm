import { describe, it, expect } from '@jest/globals'

/**
 * Promotion Targeting Logic Tests
 *
 * Tests for customer targeting and promotion eligibility logic
 */

describe('Promotion Targeting', () => {
  describe('Customer Eligibility', () => {
    it('should identify new customer (first booking)', () => {
      const customer = {
        id: 'customer-1',
        total_bookings: 0,
        created_at: new Date('2024-12-01').toISOString(),
      }

      const isNewCustomer = customer.total_bookings === 0
      const isEligibleForNewCustomerPromo = isNewCustomer

      expect(isEligibleForNewCustomerPromo).toBe(true)
    })

    it('should identify returning customer (2+ bookings)', () => {
      const customer = {
        id: 'customer-1',
        total_bookings: 5,
        created_at: new Date('2024-01-01').toISOString(),
      }

      const isReturningCustomer = customer.total_bookings >= 2
      const isEligibleForLoyaltyPromo = isReturningCustomer

      expect(isEligibleForLoyaltyPromo).toBe(true)
    })

    it('should identify inactive customer (no booking in 180+ days)', () => {
      const customer = {
        id: 'customer-1',
        last_booking_date: new Date('2024-01-01').toISOString(),
      }

      const daysSinceLastBooking = Math.floor(
        (new Date('2024-12-01').getTime() -
          new Date(customer.last_booking_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      const isInactive = daysSinceLastBooking >= 180
      const isEligibleForWinBackPromo = isInactive

      expect(isEligibleForWinBackPromo).toBe(true)
      expect(daysSinceLastBooking).toBeGreaterThanOrEqual(180)
    })

    it('should not target active customer for win-back', () => {
      const customer = {
        id: 'customer-1',
        last_booking_date: new Date('2024-11-15').toISOString(),
      }

      const daysSinceLastBooking = Math.floor(
        (new Date('2024-12-01').getTime() -
          new Date(customer.last_booking_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      const isInactive = daysSinceLastBooking >= 180
      const isEligibleForWinBackPromo = isInactive

      expect(isEligibleForWinBackPromo).toBe(false)
      expect(daysSinceLastBooking).toBeLessThan(180)
    })
  })

  describe('Geographic Targeting', () => {
    it('should match customer in target zip codes', () => {
      const customer = {
        zip_code: '90210',
      }

      const targetZipCodes = ['90210', '90211', '90212']
      const isInTargetArea = targetZipCodes.includes(customer.zip_code)

      expect(isInTargetArea).toBe(true)
    })

    it('should exclude customer outside target zip codes', () => {
      const customer = {
        zip_code: '10001',
      }

      const targetZipCodes = ['90210', '90211', '90212']
      const isInTargetArea = targetZipCodes.includes(customer.zip_code)

      expect(isInTargetArea).toBe(false)
    })

    it('should match all customers when no geographic filter', () => {
      const customer = {
        zip_code: '10001',
      }

      const targetZipCodes: string[] = [] // Empty means all
      const isInTargetArea =
        targetZipCodes.length === 0 || targetZipCodes.includes(customer.zip_code)

      expect(isInTargetArea).toBe(true)
    })
  })

  describe('Service Type Targeting', () => {
    it('should match customer with target service history', () => {
      const customer = {
        service_history: ['Carpet Cleaning', 'Upholstery Cleaning'],
      }

      const targetServices = ['Carpet Cleaning']
      const hasTargetService = customer.service_history.some((service) =>
        targetServices.includes(service)
      )

      expect(hasTargetService).toBe(true)
    })

    it('should exclude customer without target service history', () => {
      const customer = {
        service_history: ['Tile & Grout', 'Water Damage'],
      }

      const targetServices = ['Carpet Cleaning']
      const hasTargetService = customer.service_history.some((service) =>
        targetServices.includes(service)
      )

      expect(hasTargetService).toBe(false)
    })

    it('should match all customers when no service filter', () => {
      const customer = {
        service_history: ['Tile & Grout'],
      }

      const targetServices: string[] = [] // Empty means all
      const hasTargetService =
        targetServices.length === 0 ||
        customer.service_history.some((service) =>
          targetServices.includes(service)
        )

      expect(hasTargetService).toBe(true)
    })
  })

  describe('Spending Threshold Targeting', () => {
    it('should match customer above minimum spend', () => {
      const customer = {
        lifetime_value: 1500,
      }

      const minSpend = 1000
      const meetsSpendThreshold = customer.lifetime_value >= minSpend

      expect(meetsSpendThreshold).toBe(true)
    })

    it('should exclude customer below minimum spend', () => {
      const customer = {
        lifetime_value: 500,
      }

      const minSpend = 1000
      const meetsSpendThreshold = customer.lifetime_value >= minSpend

      expect(meetsSpendThreshold).toBe(false)
    })

    it('should handle edge case at exact threshold', () => {
      const customer = {
        lifetime_value: 1000,
      }

      const minSpend = 1000
      const meetsSpendThreshold = customer.lifetime_value >= minSpend

      expect(meetsSpendThreshold).toBe(true)
    })
  })

  describe('Combined Targeting Logic', () => {
    it('should match customer meeting all criteria', () => {
      const customer = {
        id: 'customer-1',
        total_bookings: 5,
        zip_code: '90210',
        service_history: ['Carpet Cleaning'],
        lifetime_value: 1500,
        last_booking_date: new Date('2024-11-15').toISOString(),
      }

      const criteria = {
        min_bookings: 2,
        target_zip_codes: ['90210', '90211'],
        target_services: ['Carpet Cleaning'],
        min_spend: 1000,
      }

      const meetsAllCriteria =
        customer.total_bookings >= criteria.min_bookings &&
        criteria.target_zip_codes.includes(customer.zip_code) &&
        customer.service_history.some((service) =>
          criteria.target_services.includes(service)
        ) &&
        customer.lifetime_value >= criteria.min_spend

      expect(meetsAllCriteria).toBe(true)
    })

    it('should exclude customer failing any criterion', () => {
      const customer = {
        id: 'customer-1',
        total_bookings: 1, // Fails min_bookings
        zip_code: '90210',
        service_history: ['Carpet Cleaning'],
        lifetime_value: 1500,
      }

      const criteria = {
        min_bookings: 2,
        target_zip_codes: ['90210', '90211'],
        target_services: ['Carpet Cleaning'],
        min_spend: 1000,
      }

      const meetsAllCriteria =
        customer.total_bookings >= criteria.min_bookings &&
        criteria.target_zip_codes.includes(customer.zip_code) &&
        customer.service_history.some((service) =>
          criteria.target_services.includes(service)
        ) &&
        customer.lifetime_value >= criteria.min_spend

      expect(meetsAllCriteria).toBe(false)
    })
  })
})
