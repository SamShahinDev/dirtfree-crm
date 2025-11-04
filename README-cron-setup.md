# SMS Reminder Cron Setup

## Overview

The Dirt Free CRM includes an automated SMS reminder system that runs via Vercel cron jobs. This system safely processes due reminders while respecting quiet hours and handling concurrent execution.

## Quick Setup

### 1. Set Environment Variables

Add these to your Vercel project environment variables:

```bash
CRON_SECRET=your-secure-random-string-here
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number
```

**Important:** Use a strong, random string for `CRON_SECRET`. This authenticates cron requests.

### 2. Deploy

The cron job is automatically configured via `vercel.json` to run every 15 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### 3. Verify Setup

Check the Vercel dashboard under "Functions" > "Crons" to confirm the job is scheduled.

## How It Works

### Safety Features

- **Authentication**: Requires `Bearer ${CRON_SECRET}` header
- **Quiet Hours**: Respects 9PM-8AM Central Time (no messages sent)
- **Concurrent Safety**: Uses row-level locking (`FOR UPDATE SKIP LOCKED`)
- **Batch Processing**: Processes 50 reminders per run
- **Retry Logic**: Max 3 attempts with exponential backoff
- **Idempotent Logging**: Prevents duplicate messages via deterministic IDs

### Processing Flow

1. **Authentication Check** - Validates cron secret
2. **Quiet Hours Check** - Skips during 9PM-8AM CT
3. **Select & Lock** - Finds due reminders with database locking
4. **Batch Process** - Sends SMS messages in batches
5. **Audit & Cleanup** - Logs all attempts and unlocks records

### Database Safety

The system adds these fields for safe concurrent processing:

```sql
-- Added to reminders table
locked_at timestamptz         -- Processing lock timestamp
last_attempt_at timestamptz   -- Last send attempt
attempt_count int default 0   -- Number of send attempts
```

### Monitoring

Check these locations for monitoring:

- **Vercel Functions Tab**: Cron execution logs
- **Database `audit_logs`**: All send attempts with metadata
- **Database `communication_logs`**: SMS delivery status

## Manual Testing

Test the cron endpoint locally:

```bash
curl -X POST http://localhost:3000/api/cron/send-reminders \
  -H "Authorization: Bearer your-cron-secret"
```

## Configuration Options

You can adjust these constants in `/src/app/api/cron/send-reminders/route.ts`:

- `BATCH_SIZE`: Number of reminders per run (default: 50)
- `MAX_ATTEMPTS`: Max retry attempts (default: 3)
- Quiet hours range in `/src/lib/time/ct.ts`

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check `CRON_SECRET` environment variable
2. **No reminders processed**: Verify reminder data in database
3. **SMS not sending**: Check Twilio credentials and phone number format

### Debug Information

The cron response includes debug info:

```json
{
  "ok": true,
  "processed": 25,
  "sent": 20,
  "skipped": 3,
  "failures": 2,
  "debug": {
    "quietHours": {
      "currentTimeCT": "Mar 15, 2024, 2:30 PM",
      "isQuietHours": false
    },
    "batchSize": 50,
    "timeInfo": {
      "durationMs": 1250
    }
  }
}
```

This provides visibility into processing results and timing information.