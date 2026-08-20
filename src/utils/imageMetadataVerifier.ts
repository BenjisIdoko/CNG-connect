export interface VerificationResult {
  isValid: boolean;
  reason?: string;
  capturedAt?: string;
  ageMinutes?: number;
  hash?: string;
}

// Global registry of verified community image hashes to prevent re-sharing old photos
const sharedImageHashes = new Set<string>();

/**
 * Computes a fast perceptual string signature of an image Data URL
 */
const computeImageHash = (dataUrl: string): string => {
  let hash = 0;
  for (let i = 0; i < Math.min(dataUrl.length, 10000); i++) {
    const char = dataUrl.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `img_hash_${Math.abs(hash)}`;
};

/**
 * Verifies image metadata freshness & anti-repost rules:
 * 1. Photo must be captured via live camera (lastModified within 30 minutes).
 * 2. Photo must not be a duplicate re-shared old image.
 */
export const verifyImageMetadata = (
  file?: File,
  dataUrl?: string,
  maxAgeMinutes: number = 30
): VerificationResult => {
  // If verifying file object from live camera input
  if (file) {
    const fileLastModified = file.lastModified;
    const now = Date.now();
    const ageMs = now - fileLastModified;
    const ageMinutes = Math.round(ageMs / (1000 * 60));

    if (ageMinutes > maxAgeMinutes) {
      return {
        isValid: false,
        ageMinutes,
        reason: `Image timestamp is ${ageMinutes} minutes old. Anti-misinformation rules require a live photo taken within the last ${maxAgeMinutes} minutes.`,
      };
    }
  }

  // If verifying data URL for duplicate re-shares
  if (dataUrl) {
    const imageHash = computeImageHash(dataUrl);
    if (sharedImageHashes.has(imageHash)) {
      return {
        isValid: false,
        hash: imageHash,
        reason: 'Duplicate photo detected! This image was already shared previously in the community feed.',
      };
    }
    sharedImageHashes.add(imageHash);
    return {
      isValid: true,
      hash: imageHash,
    };
  }

  return {
    isValid: true,
    ageMinutes: 0,
  };
};

/**
 * Registers an image hash when a post or report is successfully published
 */
export const registerSharedImageHash = (dataUrl: string): void => {
  const hash = computeImageHash(dataUrl);
  sharedImageHashes.add(hash);
};
