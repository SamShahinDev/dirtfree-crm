/**
 * Stable test selectors using data-testid attributes
 * These should correspond to actual testids in the application
 */

export const selectors = {
  // Authentication
  auth: {
    emailInput: '[data-testid="email-input"]',
    passwordInput: '[data-testid="password-input"]',
    loginButton: '[data-testid="login-button"]',
    logoutButton: '[data-testid="logout-button"]',
    userMenu: '[data-testid="user-menu"]',
  },

  // Navigation
  nav: {
    dashboard: '[data-testid="nav-dashboard"]',
    jobs: '[data-testid="nav-jobs"]',
    customers: '[data-testid="nav-customers"]',
    schedule: '[data-testid="nav-schedule"]',
    zoneBoard: '[data-testid="nav-zone-board"]',
    reminders: '[data-testid="nav-reminders"]',
    reports: '[data-testid="nav-reports"]',
    settings: '[data-testid="nav-settings"]',
  },

  // Jobs page
  jobs: {
    list: '[data-testid="jobs-list"]',
    jobCard: '[data-testid="job-card"]',
    jobTitle: '[data-testid="job-title"]',
    jobStatus: '[data-testid="job-status"]',
    jobCustomer: '[data-testid="job-customer"]',
    jobTech: '[data-testid="job-tech"]',
    jobZone: '[data-testid="job-zone"]',
    completeButton: '[data-testid="job-complete-button"]',
    editButton: '[data-testid="job-edit-button"]',
    viewButton: '[data-testid="job-view-button"]',
  },

  // Customers page
  customers: {
    list: '[data-testid="customers-list"]',
    customerCard: '[data-testid="customer-card"]',
    customerName: '[data-testid="customer-name"]',
    customerPhone: '[data-testid="customer-phone"]',
    customerEmail: '[data-testid="customer-email"]',
    addButton: '[data-testid="add-customer-button"]',
    editButton: '[data-testid="customer-edit-button"]',
  },

  // Zone Board
  zoneBoard: {
    container: '[data-testid="zone-board"]',
    zone: '[data-testid="zone-column"]',
    zoneTitle: '[data-testid="zone-title"]',
    jobCard: '[data-testid="zone-job-card"]',
    techSection: '[data-testid="tech-section"]',
    dragHandle: '[data-testid="drag-handle"]',
    dropZone: '[data-testid="drop-zone"]',
  },

  // Reminders
  reminders: {
    list: '[data-testid="reminders-list"]',
    reminderCard: '[data-testid="reminder-card"]',
    reminderType: '[data-testid="reminder-type"]',
    reminderStatus: '[data-testid="reminder-status"]',
    reminderDate: '[data-testid="reminder-date"]',
    sendSmsButton: '[data-testid="send-sms-button"]',
    snoozeButton: '[data-testid="snooze-button"]',
    markCompleteButton: '[data-testid="mark-complete-button"]',
  },

  // Dialogs and Modals
  dialog: {
    overlay: '[data-testid="dialog-overlay"]',
    content: '[data-testid="dialog-content"]',
    title: '[data-testid="dialog-title"]',
    description: '[data-testid="dialog-description"]',
    closeButton: '[data-testid="dialog-close"]',
    cancelButton: '[data-testid="dialog-cancel"]',
    confirmButton: '[data-testid="dialog-confirm"]',
    submitButton: '[data-testid="dialog-submit"]',
  },

  // Follow-up picker dialog
  followUpPicker: {
    dialog: '[data-testid="follow-up-picker-dialog"]',
    dateInput: '[data-testid="follow-up-date-input"]',
    typeSelect: '[data-testid="follow-up-type-select"]',
    messageTextarea: '[data-testid="follow-up-message-textarea"]',
    acceptButton: '[data-testid="follow-up-accept-button"]',
    cancelButton: '[data-testid="follow-up-cancel-button"]',
  },

  // Forms
  form: {
    field: '[data-testid="form-field"]',
    input: '[data-testid="form-input"]',
    textarea: '[data-testid="form-textarea"]',
    select: '[data-testid="form-select"]',
    checkbox: '[data-testid="form-checkbox"]',
    submitButton: '[data-testid="form-submit"]',
    resetButton: '[data-testid="form-reset"]',
    errorMessage: '[data-testid="form-error"]',
  },

  // File uploads
  upload: {
    input: '[data-testid="file-upload-input"]',
    dropZone: '[data-testid="file-drop-zone"]',
    preview: '[data-testid="file-preview"]',
    removeButton: '[data-testid="file-remove-button"]',
    uploadButton: '[data-testid="file-upload-button"]',
    errorMessage: '[data-testid="upload-error"]',
    successMessage: '[data-testid="upload-success"]',
  },

  // Toast notifications
  toast: {
    container: '[data-testid="toast-container"]',
    message: '[data-testid="toast-message"]',
    closeButton: '[data-testid="toast-close"]',
    errorToast: '[data-testid="error-toast"]',
    successToast: '[data-testid="success-toast"]',
    warningToast: '[data-testid="warning-toast"]',
  },

  // Loading states
  loading: {
    spinner: '[data-testid="loading-spinner"]',
    skeleton: '[data-testid="loading-skeleton"]',
    overlay: '[data-testid="loading-overlay"]',
  },

  // Data tables
  table: {
    container: '[data-testid="data-table"]',
    header: '[data-testid="table-header"]',
    row: '[data-testid="table-row"]',
    cell: '[data-testid="table-cell"]',
    pagination: '[data-testid="table-pagination"]',
    sortButton: '[data-testid="table-sort"]',
    filterInput: '[data-testid="table-filter"]',
  },

  // Specific pages
  dashboard: {
    welcomeMessage: '[data-testid="welcome-message"]',
    statsCard: '[data-testid="stats-card"]',
    recentJobs: '[data-testid="recent-jobs"]',
    upcomingReminders: '[data-testid="upcoming-reminders"]',
  },

  // Error states
  error: {
    message: '[data-testid="error-message"]',
    boundary: '[data-testid="error-boundary"]',
    retryButton: '[data-testid="error-retry"]',
    notFound: '[data-testid="not-found"]',
    unauthorized: '[data-testid="unauthorized"]',
  },
};

/**
 * Helper functions for common selector patterns
 */
export const selectorHelpers = {
  /**
   * Get a job card by customer name
   */
  jobByCustomer: (customerName: string) => `${selectors.jobs.jobCard}:has-text("${customerName}")`,

  /**
   * Get a customer card by name
   */
  customerByName: (customerName: string) => `${selectors.customers.customerCard}:has-text("${customerName}")`,

  /**
   * Get a zone column by zone name
   */
  zoneByName: (zoneName: string) => `${selectors.zoneBoard.zone}:has(${selectors.zoneBoard.zoneTitle}:has-text("${zoneName}"))`,

  /**
   * Get a reminder by customer name
   */
  reminderByCustomer: (customerName: string) => `${selectors.reminders.reminderCard}:has-text("${customerName}")`,

  /**
   * Get a form field by label
   */
  fieldByLabel: (label: string) => `${selectors.form.field}:has(label:has-text("${label}"))`,

  /**
   * Get a table row by text content
   */
  rowByText: (text: string) => `${selectors.table.row}:has-text("${text}")`,

  /**
   * Get an element by its test id
   */
  byTestId: (testId: string) => `[data-testid="${testId}"]`,

  /**
   * Get an element by test id with specific text
   */
  byTestIdAndText: (testId: string, text: string) => `[data-testid="${testId}"]:has-text("${text}")`,
};

export default selectors;