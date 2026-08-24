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
 * Computes a fast perceptual string signature of an image Data URL.
 * Samples characters across the ENTIRE payload (stride-based) instead of
 * only the first N chars — long identical base64 headers no longer dominate
 * the hash, which previously made distinct images collide as duplicates.
 */
const computeImageHash = (dataUrl: string): string => {
  let hash = 0;
  const len = dataUrl.length;
  const stride = Math.max(1, Math.floor(len / 4096));
  for (let i = 0; i < len; i += stride) {
    hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
    hash |= 0;
  }
  // Always fold in the trailing bytes (most unique part of an image payload)
  for (let i = Math.max(0, len - 256); i < len; i++) {
    hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
    hash |= 0;
  }
  return `img_hash_${Math.abs(hash)}`;
};

/**
 * Verifies image metadata freshness & anti-repost rules:
 * 1. Photo must be captured via live camera (lastModified within maxAgeMinutes).
 * 2. Photo must not be a duplicate re-shared old image.
 *
 * NOTE: This check does NOT register the image hash. Registration happens
 * exclusively via registerSharedImageHash() at publish time, so verifying a
 * photo and then abandoning the draft must not blacklist the photo.
 */
export const verifyImageMetadata = (
  file?: File,
  dataUrl?: string,
  maxAgeMinutes: number = 30
): VerificationResult => {
  if (!file && !dataUrl) {
    return {
      isValid: false,
      reason: 'No image provided for verification.',
    };
  }

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
