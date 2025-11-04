import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

interface SMSOptions {
  to: string
  message: string
}

export async function sendSMS(options: SMSOptions): Promise<void> {
  const { to, message } = options

  // Format phone number
  let formattedPhone = to.replace(/\D/g, '')
  if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
    formattedPhone = '1' + formattedPhone
  }
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone
  }

  try {
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
      body: message,
    })
  } catch (error) {
    console.error('Failed to send SMS:', error)
    throw error
  }
}
