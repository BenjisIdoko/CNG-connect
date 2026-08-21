import { describe, it, expect } from 'vitest';
import { verifyImageMetadata, registerSharedImageHash } from './imageMetadataVerifier';

describe('Image Metadata & Recency Verification Engine', () => {
  it('should pass validation for recent image files (< 30 minutes old)', () => {
    const recentFile = new File(['fake image data'], 'pump.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now() - 5 * 60 * 1000, // 5 minutes ago
    });

    const result = verifyImageMetadata(recentFile, undefined, 30);
    expect(result.isValid).toBe(true);
  });

  it('should reject image files older than maximum age threshold (30 minutes)', () => {
    const oldFile = new File(['old image data'], 'old_pump.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now() - 45 * 60 * 1000, // 45 minutes ago
    });

    const result = verifyImageMetadata(oldFile, undefined, 30);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('within the last 30 minutes');
  });

  it('should detect duplicate photo uploads using perceptual hash registration', () => {
    const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // Register image hash
    registerSharedImageHash(sampleDataUrl);

    // Verify same dataUrl is rejected
    const result = verifyImageMetadata(undefined, sampleDataUrl);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Duplicate');
  });
});
