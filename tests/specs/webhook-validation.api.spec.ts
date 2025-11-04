import { test, expect } from '@playwright/test';
import crypto from 'crypto';

test.describe('Webhook Validation', () => {
  test('rejects webhook with invalid Twilio signature', async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Sample webhook payload from Twilio
    const webhookPayload = {
      MessageSid: 'SM1234567890abcdef1234567890abcdef',
      AccountSid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      From: '+15555551234',
      To: '+15555559999',
      Body: 'Test message',
      MessageStatus: 'delivered',
      ApiVersion: '2010-04-01',
    };

    // Create URL-encoded payload (how Twilio sends webhooks)
    const urlEncodedPayload = new URLSearchParams(webhookPayload).toString();

    // Create an INVALID signature (not matching the payload)
    const invalidSignature = 'invalid-signature-12345';

    // Make request to Twilio webhook endpoint with bad signature
    const response = await request.post(`${baseURL}/api/twilio/webhook`, {
      data: urlEncodedPayload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': invalidSignature,
      },
    });

    // Should return 401 Unauthorized
    expect(response.status()).toBe(401);

    const responseBody = await response.json();
    expect(responseBody.error).toBeTruthy();
    expect(responseBody.error.toLowerCase()).toContain('unauthorized');

    // Verify no logs were created in the database
    const logsResponse = await request.get(`${baseURL}/api/sms/logs?message_sid=${webhookPayload.MessageSid}`);

    if (logsResponse.ok()) {
      const logs = await logsResponse.json();

      // Should not find any logs for this message SID since webhook was rejected
      expect(logs).toHaveLength(0);
    }
  });

  test('accepts webhook with valid Twilio signature', async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Sample webhook payload from Twilio
    const webhookPayload = {
      MessageSid: 'SM1234567890abcdef1234567890abcdef',
      AccountSid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      From: '+15555551234',
      To: '+15555559999',
      Body: 'Test message for valid signature',
      MessageStatus: 'delivered',
      ApiVersion: '2010-04-01',
    };

    // Create URL-encoded payload
    const urlEncodedPayload = new URLSearchParams(webhookPayload).toString();

    // Create a valid Twilio signature
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'test-auth-token';
    const url = `${baseURL}/api/twilio/webhook`;

    // Twilio signature calculation: HMAC-SHA1 of URL + POST body
    const data = url + urlEncodedPayload;
    const validSignature = crypto
      .createHmac('sha1', authToken)
      .update(data, 'utf8')
      .digest('base64');

    // Make request with valid signature
    const response = await request.post(`${baseURL}/api/twilio/webhook`, {
      data: urlEncodedPayload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': validSignature,
      },
    });

    // Should accept the webhook (200 or 204)
    expect([200, 204]).toContain(response.status());

    // Verify logs were created
    // Note: This assumes the webhook handler creates SMS logs
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for async processing

    const logsResponse = await request.get(`${baseURL}/api/sms/logs?message_sid=${webhookPayload.MessageSid}`);

    if (logsResponse.ok()) {
      const logs = await logsResponse.json();

      // Should find the log entry for this webhook
      expect(logs.length).toBeGreaterThan(0);

      const log = logs.find((l: any) => l.message_sid === webhookPayload.MessageSid);
      expect(log).toBeTruthy();
      expect(log.from_number).toBe(webhookPayload.From);
      expect(log.to_number).toBe(webhookPayload.To);
      expect(log.message).toBe(webhookPayload.Body);
      expect(log.status).toBe(webhookPayload.MessageStatus);
    }
  });

  test('handles malformed webhook payloads gracefully', async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Test with completely malformed payload
    const response1 = await request.post(`${baseURL}/api/twilio/webhook`, {
      data: 'invalid-payload-format',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'some-signature',
      },
    });

    // Should handle gracefully (probably 400 or 401)
    expect([400, 401]).toContain(response1.status());

    // Test with missing required headers
    const response2 = await request.post(`${baseURL}/api/twilio/webhook`, {
      data: 'MessageSid=SM123&From=+1234567890',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Missing X-Twilio-Signature header
      },
    });

    // Should reject due to missing signature
    expect([400, 401]).toContain(response2.status());

    // Test with empty payload
    const response3 = await request.post(`${baseURL}/api/twilio/webhook`, {
      data: '',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'some-signature',
      },
    });

    // Should handle empty payload gracefully
    expect([400, 401]).toContain(response3.status());
  });

  test('webhook endpoint requires POST method', async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Test GET request (should not be allowed)
    const getResponse = await request.get(`${baseURL}/api/twilio/webhook`);
    expect([405, 404]).toContain(getResponse.status()); // Method Not Allowed or Not Found

    // Test PUT request (should not be allowed)
    const putResponse = await request.put(`${baseURL}/api/twilio/webhook`, {
      data: 'test-data',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    expect([405, 404]).toContain(putResponse.status());

    // Test DELETE request (should not be allowed)
    const deleteResponse = await request.delete(`${baseURL}/api/twilio/webhook`);
    expect([405, 404]).toContain(deleteResponse.status());
  });

  test('webhook validates required Twilio fields', async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'test-auth-token';

    // Test with missing MessageSid
    const incompletePayload1 = new URLSearchParams({
      From: '+15555551234',
      To: '+15555559999',
      Body: 'Test message',
      // Missing MessageSid
    }).toString();

    const url = `${baseURL}/api/twilio/webhook`;
    const signature1 = crypto
      .createHmac('sha1', authToken)
      .update(url + incompletePayload1, 'utf8')
      .digest('base64');

    const response1 = await request.post(`${baseURL}/api/twilio/webhook`, {
      data: incompletePayload1,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': signature1,
      },
    });

    // Should reject incomplete payload
    expect([400, 422]).toContain(response1.status());

    // Test with missing From field
    const incompletePayload2 = new URLSearchParams({
      MessageSid: 'SM1234567890abcdef1234567890abcdef',
      To: '+15555559999',
      Body: 'Test message',
      // Missing From
    }).toString();

    const signature2 = crypto
      .createHmac('sha1', authToken)
      .update(url + incompletePayload2, 'utf8')
      .digest('base64');

    const response2 = await request.post(`${baseURL}/api/twilio/webhook`, {
      data: incompletePayload2,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': signature2,
      },
    });

    // Should reject incomplete payload
    expect([400, 422]).toContain(response2.status());
  });

  test('webhook processes different message statuses correctly', async ({ request }) => {
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'test-auth-token';
    const url = `${baseURL}/api/twilio/webhook`;

    const messageStatuses = ['sent', 'delivered', 'failed', 'undelivered'];

    for (const status of messageStatuses) {
      const webhookPayload = new URLSearchParams({
        MessageSid: `SM${status}1234567890abcdef1234567890`,
        AccountSid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        From: '+15555551234',
        To: '+15555559999',
        Body: `Test message with ${status} status`,
        MessageStatus: status,
        ApiVersion: '2010-04-01',
      }).toString();

      const signature = crypto
        .createHmac('sha1', authToken)
        .update(url + webhookPayload, 'utf8')
        .digest('base64');

      const response = await request.post(`${baseURL}/api/twilio/webhook`, {
        data: webhookPayload,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Twilio-Signature': signature,
        },
      });

      // Should accept all valid statuses
      expect([200, 204]).toContain(response.status());

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify the status was recorded correctly
      const logsResponse = await request.get(`${baseURL}/api/sms/logs?message_sid=SM${status}1234567890abcdef1234567890`);

      if (logsResponse.ok()) {
        const logs = await logsResponse.json();
        expect(logs.length).toBeGreaterThan(0);

        const log = logs[0];
        expect(log.status).toBe(status);
      }
    }
  });
});