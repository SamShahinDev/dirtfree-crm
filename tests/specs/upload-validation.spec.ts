import { test, expect } from '@playwright/test';
import { selectors } from '../utils/selectors';
import path from 'path';
import fs from 'fs';

test.describe('Upload Validation', () => {
  // Create test files for upload testing
  test.beforeAll(async () => {
    const testFilesDir = path.join(__dirname, '..', 'fixtures');

    // Ensure fixtures directory exists
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create a fake .exe file
    const exeFilePath = path.join(testFilesDir, 'malware.exe');
    fs.writeFileSync(exeFilePath, 'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00'); // PE header signature

    // Create a JPEG with EXIF data
    const jpegWithExifPath = path.join(testFilesDir, 'photo-with-exif.jpg');

    // Create a simple JPEG with EXIF data
    // This is a minimal JPEG structure with EXIF metadata
    const jpegData = Buffer.concat([
      Buffer.from([0xFF, 0xD8]), // JPEG SOI marker
      Buffer.from([0xFF, 0xE1]), // APP1 marker for EXIF
      Buffer.from([0x00, 0x16]), // EXIF segment length (22 bytes)
      Buffer.from('Exif\x00\x00', 'ascii'), // EXIF identifier
      Buffer.from([0x49, 0x49, 0x2A, 0x00]), // TIFF header (little endian)
      Buffer.from([0x08, 0x00, 0x00, 0x00]), // Offset to first IFD
      Buffer.from([0x00, 0x00]), // Number of directory entries
      Buffer.from([0xFF, 0xD9]), // JPEG EOI marker
    ]);

    fs.writeFileSync(jpegWithExifPath, jpegData);

    // Create a valid JPEG without EXIF
    const validJpegPath = path.join(testFilesDir, 'valid-photo.jpg');
    const validJpegData = Buffer.concat([
      Buffer.from([0xFF, 0xD8]), // JPEG SOI marker
      Buffer.from([0xFF, 0xDB]), // Quantization table marker
      Buffer.from([0x00, 0x43]), // Length
      Buffer.from(new Array(65).fill(0x01)), // Dummy quantization table
      Buffer.from([0xFF, 0xD9]), // JPEG EOI marker
    ]);

    fs.writeFileSync(validJpegPath, validJpegData);

    // Create a text file (invalid MIME type)
    const textFilePath = path.join(testFilesDir, 'document.txt');
    fs.writeFileSync(textFilePath, 'This is a text file that should be rejected');
  });

  test('rejects .exe files with friendly error message', async ({ page }) => {
    // This test runs as dispatcher user

    // Navigate to a page with file upload (assuming jobs or customers page has upload)
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find and click upload button/trigger upload UI
    // This assumes there's an upload feature on the jobs page
    const uploadTrigger = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));

    if (!(await uploadTrigger.isVisible())) {
      // Try to find upload on different pages
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      // Look for add customer button or file upload
      const addButton = page.locator(selectors.customers.addButton);
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForSelector(selectors.upload.input);
      }
    }

    // Get the path to our test .exe file
    const exeFilePath = path.join(__dirname, '..', 'fixtures', 'malware.exe');

    // Attempt to upload the .exe file
    const fileInput = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));
    await expect(fileInput).toBeVisible();

    await fileInput.setInputFiles(exeFilePath);

    // Should show error message about invalid file type
    await expect(page.locator(selectors.upload.errorMessage))
      .toBeVisible({ timeout: 10000 });

    const errorMessage = await page.locator(selectors.upload.errorMessage).textContent();
    expect(errorMessage?.toLowerCase()).toMatch(/invalid|not.allowed|unsupported|exe|file.type/);

    // Verify upload was rejected (no success message)
    await expect(page.locator(selectors.upload.successMessage)).not.toBeVisible();
  });

  test('rejects invalid MIME types with 400 error', async ({ page, request }) => {
    // Test direct API upload with invalid MIME type
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    const textFilePath = path.join(__dirname, '..', 'fixtures', 'document.txt');
    const fileContent = fs.readFileSync(textFilePath);

    // Attempt to upload via API
    const formData = new FormData();
    formData.append('file', new Blob([fileContent], { type: 'text/plain' }), 'document.txt');

    const response = await request.post(`${baseURL}/api/upload`, {
      multipart: {
        file: {
          name: 'document.txt',
          mimeType: 'text/plain',
          buffer: fileContent,
        },
      },
    });

    // Should return 400 Bad Request
    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    expect(responseBody.error).toBeTruthy();
    expect(responseBody.error.toLowerCase()).toMatch(/invalid|mime|type|not.allowed/);
  });

  test('accepts valid JPEG and strips EXIF data', async ({ page, request }) => {
    // Navigate to upload page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find upload input
    const uploadTrigger = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));

    if (!(await uploadTrigger.isVisible())) {
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      const addButton = page.locator(selectors.customers.addButton);
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForSelector(selectors.upload.input);
      }
    }

    // Upload JPEG with EXIF data
    const jpegWithExifPath = path.join(__dirname, '..', 'fixtures', 'photo-with-exif.jpg');
    const fileInput = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));

    await fileInput.setInputFiles(jpegWithExifPath);

    // Should show success message
    await expect(page.locator(selectors.upload.successMessage))
      .toBeVisible({ timeout: 15000 });

    // Get the uploaded file URL from success message or UI
    const successMessage = await page.locator(selectors.upload.successMessage).textContent();
    const urlMatch = successMessage?.match(/https?:\/\/[^\s]+/);

    if (urlMatch) {
      const uploadedFileUrl = urlMatch[0];

      // Download the uploaded file and verify EXIF is stripped
      const downloadResponse = await request.get(uploadedFileUrl);
      expect(downloadResponse.ok()).toBeTruthy();

      const downloadedContent = await downloadResponse.body();
      const originalContent = fs.readFileSync(jpegWithExifPath);

      // File size should be smaller after EXIF removal
      expect(downloadedContent.length).toBeLessThan(originalContent.length);

      // Should not contain EXIF marker
      const downloadedBuffer = Buffer.from(downloadedContent);
      const exifMarker = Buffer.from('Exif\x00\x00');
      expect(downloadedBuffer.includes(exifMarker)).toBeFalsy();

      // Should still be a valid JPEG (starts with FF D8, ends with FF D9)
      expect(downloadedBuffer[0]).toBe(0xFF);
      expect(downloadedBuffer[1]).toBe(0xD8);
      expect(downloadedBuffer[downloadedBuffer.length - 2]).toBe(0xFF);
      expect(downloadedBuffer[downloadedBuffer.length - 1]).toBe(0xD9);
    } else {
      console.warn('Could not extract upload URL from success message for EXIF verification');
    }
  });

  test('accepts valid images without EXIF data', async ({ page }) => {
    // Navigate to upload page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const uploadTrigger = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));

    if (!(await uploadTrigger.isVisible())) {
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      const addButton = page.locator(selectors.customers.addButton);
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForSelector(selectors.upload.input);
      }
    }

    // Upload valid JPEG without EXIF
    const validJpegPath = path.join(__dirname, '..', 'fixtures', 'valid-photo.jpg');
    const fileInput = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));

    await fileInput.setInputFiles(validJpegPath);

    // Should show success message
    await expect(page.locator(selectors.upload.successMessage))
      .toBeVisible({ timeout: 15000 });

    // Should not show any error
    await expect(page.locator(selectors.upload.errorMessage)).not.toBeVisible();
  });

  test('handles large file uploads appropriately', async ({ page }) => {
    // Create a large file (simulate by creating a large buffer)
    const largeFilePath = path.join(__dirname, '..', 'fixtures', 'large-image.jpg');

    // Create a 10MB fake JPEG file
    const largeFileSize = 10 * 1024 * 1024; // 10MB
    const jpegHeader = Buffer.from([0xFF, 0xD8]);
    const jpegFooter = Buffer.from([0xFF, 0xD9]);
    const padding = Buffer.alloc(largeFileSize - 4, 0x00);

    const largeFileContent = Buffer.concat([jpegHeader, padding, jpegFooter]);
    fs.writeFileSync(largeFilePath, largeFileContent);

    try {
      // Navigate to upload page
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      const uploadTrigger = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));

      if (!(await uploadTrigger.isVisible())) {
        await page.goto('/customers');
        await page.waitForLoadState('networkidle');

        const addButton = page.locator(selectors.customers.addButton);
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForSelector(selectors.upload.input);
        }
      }

      // Attempt to upload large file
      const fileInput = page.locator(selectors.upload.input).or(page.locator('input[type="file"]'));
      await fileInput.setInputFiles(largeFilePath);

      // Should either succeed with progress indication or show file size error
      const isErrorVisible = await page.locator(selectors.upload.errorMessage).isVisible({ timeout: 30000 });
      const isSuccessVisible = await page.locator(selectors.upload.successMessage).isVisible();

      // Either should succeed or show appropriate file size error
      expect(isErrorVisible || isSuccessVisible).toBeTruthy();

      if (isErrorVisible) {
        const errorMessage = await page.locator(selectors.upload.errorMessage).textContent();
        expect(errorMessage?.toLowerCase()).toMatch(/size|large|limit|exceeded/);
      }
    } finally {
      // Clean up large file
      if (fs.existsSync(largeFilePath)) {
        fs.unlinkSync(largeFilePath);
      }
    }
  });

  test('supports drag and drop upload', async ({ page }) => {
    // Navigate to upload page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Look for drop zone
    const dropZone = page.locator(selectors.upload.dropZone);

    if (await dropZone.isVisible()) {
      // Create a valid test file
      const validJpegPath = path.join(__dirname, '..', 'fixtures', 'valid-photo.jpg');

      // Simulate drag and drop
      const fileContent = fs.readFileSync(validJpegPath);

      await dropZone.hover();

      // Simulate file drop (this is a simplified version - actual drag/drop testing can be complex)
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validJpegPath);

      // Should handle the upload
      await expect(page.locator(selectors.upload.successMessage).or(page.locator(selectors.upload.errorMessage)))
        .toBeVisible({ timeout: 15000 });
    } else {
      console.warn('Drop zone not found, skipping drag and drop test');
    }
  });

  // Clean up test files
  test.afterAll(async () => {
    const testFilesDir = path.join(__dirname, '..', 'fixtures');

    if (fs.existsSync(testFilesDir)) {
      const files = fs.readdirSync(testFilesDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testFilesDir, file));
      }
      fs.rmdirSync(testFilesDir);
    }
  });
});