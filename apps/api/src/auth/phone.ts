const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Removes common presentation separators while retaining the required international + prefix. */
export function normalizePhoneE164(value: string): string {
  const normalized = value.trim().replace(/[\s().-]/g, "");

  if (!E164_PATTERN.test(normalized)) {
    throw new Error("INVALID_E164_PHONE");
  }

  return normalized;
}

export function isPhoneE164(value: string): boolean {
  try {
    normalizePhoneE164(value);
    return true;
  } catch {
    return false;
  }
}
