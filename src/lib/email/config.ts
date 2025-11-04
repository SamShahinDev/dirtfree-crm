export const emailConfig = {
  from: {
    name: 'Dirt Free CRM',
    email: process.env.EMAIL_FROM || 'noreply@dirtfreecrm.com'
  },
  replyTo: process.env.EMAIL_REPLY_TO || 'support@dirtfreecrm.com',
  // Email templates will be added here
};

export const emailTemplates = {
  customerWelcome: 'CUSTOMER_WELCOME',
  jobScheduled: 'JOB_SCHEDULED',
  jobCompleted: 'JOB_COMPLETED',
  jobReminder: 'JOB_REMINDER',
  invoiceSent: 'INVOICE_SENT',
  passwordReset: 'PASSWORD_RESET',
  teamInvite: 'TEAM_INVITE',
  jobCancelled: 'JOB_CANCELLED',
  paymentReceived: 'PAYMENT_RECEIVED',
  quoteRequest: 'QUOTE_REQUEST'
};