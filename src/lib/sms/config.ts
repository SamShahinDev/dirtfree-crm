export const smsConfig = {
  // Twilio configuration
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || 'AC_PLACEHOLDER_ACCOUNT_SID',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || 'PLACEHOLDER_AUTH_TOKEN',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
  twilioWebhookSecret: process.env.TWILIO_WEBHOOK_SECRET,

  // SMS settings
  enableSms: process.env.ENABLE_SMS === 'true',
  smsWebhookUrl: process.env.SMS_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/webhook`,
  enableInboundSms: process.env.ENABLE_INBOUND_SMS === 'true',

  // Rate limiting
  maxMessagesPerDay: 100,
  maxMessagesPerHour: 20,

  // Message templates
  templates: {
    // Appointment notifications
    appointmentConfirmation: 'Hi {name}, your appointment with Dirt Free is confirmed for {date} at {time}. Reply Y to confirm, R to reschedule, or C to cancel.',
    appointmentReminder: 'Reminder: Your Dirt Free service is tomorrow at {time}. We\'ll clean {services}. Reply C to cancel or call {phone} to reschedule.',
    appointmentRescheduled: 'Your appointment has been rescheduled to {date} at {time}. Reply Y to confirm this new time.',
    appointmentCancelled: 'Your appointment for {date} has been cancelled. To reschedule, reply R or call {phone}.',

    // Technician notifications
    technicianOnWay: 'Hi {name}, your Dirt Free technician {techName} is on the way! Estimated arrival: {time}. Track live: {link}',
    technicianArrived: 'Your Dirt Free technician has arrived. Please ensure pets are secured and the service area is accessible.',
    technicianDelayed: 'Your technician is running {minutes} minutes late. New arrival time: {time}. We apologize for the delay.',

    // Job completion
    jobComplete: 'Service complete! Thank you for choosing Dirt Free. Your invoice: {link}. Reply with any feedback or concerns.',

    // Follow-up
    satisfactionSurvey: 'How was your recent Dirt Free service? Reply 1-5 (5 being excellent) to rate your experience.',
    reviewRequest: 'Thank you for your 5-star rating! We\'d love if you could share your experience on Google: {link}',

    // Billing
    invoiceReady: 'Your Dirt Free invoice #{number} for ${amount} is ready. Pay online: {link} or reply PAY to pay by saved card.',
    paymentReceived: 'Payment of ${amount} received. Thank you! Your receipt: {link}',
    paymentFailed: 'Payment failed. Please update your payment method: {link} or call {phone}.',
    paymentReminder: 'Reminder: Invoice #{number} for ${amount} is due {date}. Pay now: {link}',

    // General
    welcomeMessage: 'Welcome to Dirt Free! You\'ll receive appointment updates via SMS. Reply STOP to unsubscribe anytime.',
    rescheduleRequest: 'We received your reschedule request. Please reply with 3 preferred dates/times, or call {phone}.',
    stopConfirmation: 'You\'ve been unsubscribed from Dirt Free SMS. Reply START to resubscribe.',
    startConfirmation: 'Welcome back! You\'ll now receive Dirt Free SMS updates.',
    helpMessage: 'Dirt Free SMS Commands: Y=Confirm, R=Reschedule, C=Cancel, STOP=Unsubscribe. Call {phone} for help.',

    // Error messages
    unknownCommand: 'Sorry, we didn\'t understand. Reply Y to confirm, R to reschedule, C to cancel, or HELP for assistance.',
    noAppointment: 'We couldn\'t find an upcoming appointment. Please call {phone} for assistance.',
    systemError: 'Something went wrong. Please call {phone} or try again later.'
  },

  // Keywords for parsing inbound messages
  keywords: {
    confirm: ['Y', 'YES', 'CONFIRM', 'OK', 'OKAY', 'SURE'],
    reschedule: ['R', 'RESCHEDULE', 'CHANGE', 'DIFFERENT'],
    cancel: ['C', 'CANCEL', 'NO', 'STOP SERVICE'],
    help: ['HELP', 'INFO', 'COMMANDS', '?'],
    stop: ['STOP', 'UNSUBSCRIBE', 'QUIT', 'END'],
    start: ['START', 'SUBSCRIBE', 'BEGIN', 'YES SMS'],
    pay: ['PAY', 'PAYMENT', 'PAY NOW'],
    feedback: ['FEEDBACK', 'COMPLAINT', 'ISSUE', 'PROBLEM']
  },

  // Company info for templates
  companyInfo: {
    name: process.env.COMPANY_NAME || 'Dirt Free Carpet',
    phone: process.env.COMPANY_PHONE || '(555) 123-4567',
    website: process.env.COMPANY_WEBSITE || 'https://dirtfreecrm.com',
    supportEmail: process.env.COMPANY_EMAIL || 'support@dirtfreecrm.com'
  }
}