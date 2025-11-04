import { Page } from '@playwright/test';

/**
 * Time utilities for E2E tests
 * Includes helpers for freezing time and working with Central Time
 */

export class TimeHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Freeze time to a specific date/time
   * This mocks Date.now() and new Date() in the browser
   */
  async freezeTime(date: Date): Promise<void> {
    const timestamp = date.getTime();

    await this.page.addInitScript((frozenTime) => {
      // Mock Date.now()
      Date.now = () => frozenTime;

      // Mock new Date() when called without arguments
      const OriginalDate = Date;
      // @ts-ignore
      Date = class extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(frozenTime);
          } else {
            super(...args);
          }
        }

        static now() {
          return frozenTime;
        }
      };

      // Copy static methods
      Object.setPrototypeOf(Date, OriginalDate);
      Object.defineProperty(Date, 'prototype', {
        value: OriginalDate.prototype,
        writable: false,
      });
    }, timestamp);
  }

  /**
   * Get Central Time zone offset in minutes
   * Returns -300 for CDT (UTC-5) or -360 for CST (UTC-6)
   */
  private getCentralTimeOffset(date: Date): number {
    // Simple DST calculation - assumes DST starts 2nd Sunday in March, ends 1st Sunday in November
    const year = date.getFullYear();

    // Second Sunday in March
    const dstStart = new Date(year, 2, 1); // March 1st
    dstStart.setDate(dstStart.getDate() + (14 - dstStart.getDay())); // Second Sunday

    // First Sunday in November
    const dstEnd = new Date(year, 10, 1); // November 1st
    dstEnd.setDate(dstEnd.getDate() + (7 - dstEnd.getDay())); // First Sunday

    const isDST = date >= dstStart && date < dstEnd;
    return isDST ? -300 : -360; // CDT is UTC-5, CST is UTC-6
  }

  /**
   * Convert UTC time to Central Time
   */
  toCentralTime(utcDate: Date): Date {
    const offsetMinutes = this.getCentralTimeOffset(utcDate);
    return new Date(utcDate.getTime() + offsetMinutes * 60 * 1000);
  }

  /**
   * Convert Central Time to UTC
   */
  fromCentralTime(centralDate: Date): Date {
    const offsetMinutes = this.getCentralTimeOffset(centralDate);
    return new Date(centralDate.getTime() - offsetMinutes * 60 * 1000);
  }

  /**
   * Create a Central Time date for testing
   */
  createCentralTime(year: number, month: number, day: number, hour: number = 0, minute: number = 0): Date {
    const centralDate = new Date(year, month - 1, day, hour, minute);
    return this.fromCentralTime(centralDate);
  }

  /**
   * Freeze time to Central Time quiet hours (9 PM CT)
   * Useful for testing the quiet hours deferral feature
   */
  async freezeToQuietHours(date?: Date): Promise<Date> {
    const baseDate = date || new Date();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    // Create 22:15 (10:15 PM) Central Time
    const quietHoursTime = this.createCentralTime(year, month + 1, day, 22, 15);

    await this.freezeTime(quietHoursTime);
    return quietHoursTime;
  }

  /**
   * Calculate next 8 AM Central Time from a given date
   * Used for testing reminder scheduling during quiet hours
   */
  getNext8AmCentral(fromDate: Date): Date {
    const centralTime = this.toCentralTime(fromDate);
    const next8Am = new Date(centralTime);

    // Set to 8:00 AM
    next8Am.setHours(8, 0, 0, 0);

    // If it's already past 8 AM today, move to tomorrow
    if (centralTime.getHours() >= 8) {
      next8Am.setDate(next8Am.getDate() + 1);
    }

    return this.fromCentralTime(next8Am);
  }

  /**
   * Check if a time is in Central Time quiet hours (9 PM - 8 AM)
   */
  isQuietHours(date: Date): boolean {
    const centralTime = this.toCentralTime(date);
    const hour = centralTime.getHours();
    return hour >= 21 || hour < 8; // 9 PM to 8 AM
  }

  /**
   * Format a date as Central Time string for debugging
   */
  formatCentralTime(date: Date): string {
    const centralTime = this.toCentralTime(date);
    return centralTime.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Wait for a specific number of milliseconds
   */
  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Advance time by a specific amount and update the page
   */
  async advanceTime(ms: number): Promise<void> {
    await this.page.evaluate((milliseconds) => {
      const currentTime = Date.now();
      const newTime = currentTime + milliseconds;

      // Update the frozen time
      Date.now = () => newTime;

      // Trigger any time-based updates
      window.dispatchEvent(new Event('timeupdate'));
    }, ms);
  }

  /**
   * Reset time to real time (unfreeze)
   */
  async unfreezeTime(): Promise<void> {
    await this.page.addInitScript(() => {
      // Restore original Date behavior
      delete (window as any).Date;
    });
  }
}

/**
 * Static utility functions for time manipulation
 */
export const timeUtils = {
  /**
   * Create a date string in ISO format for a specific Central Time
   */
  createCentralISOString(year: number, month: number, day: number, hour: number = 0, minute: number = 0): string {
    const helper = new TimeHelper(null as any); // We don't need page for this static method
    const date = helper.createCentralTime(year, month, day, hour, minute);
    return date.toISOString();
  },

  /**
   * Add months to a date (useful for follow-up reminders)
   */
  addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  },

  /**
   * Add days to a date
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  /**
   * Add hours to a date
   */
  addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  },

  /**
   * Check if two dates are the same day
   */
  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  },

  /**
   * Format date for form inputs (YYYY-MM-DD)
   */
  formatDateInput(date: Date): string {
    return date.toISOString().split('T')[0];
  },

  /**
   * Format time for form inputs (HH:MM)
   */
  formatTimeInput(date: Date): string {
    return date.toTimeString().slice(0, 5);
  },
};

export default TimeHelper;