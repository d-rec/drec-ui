/**
 * Extract a short, safe message from an HttpClient/Observable error
 * without leaking response bodies (e.g. base64 images that Roboflow can
 * return embedded in error payloads). Falls back through the usual
 * shapes, hard-caps length, and strips obvious base64-looking blobs.
 */
const MAX_LEN = 200;

const looksLikeBase64Blob = (s: string): boolean =>
  s.length > 80 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 200));

const cleanShort = (raw: unknown): string | null => {
  if (raw == null) return null;
  if (typeof raw !== 'string') {
    if (typeof (raw as any).message === 'string') {
      return cleanShort((raw as any).message);
    }
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (looksLikeBase64Blob(trimmed)) return null;
  return trimmed.length > MAX_LEN ? `${trimmed.slice(0, MAX_LEN)}…` : trimmed;
};

export const safeErrorMessage = (
  err: any,
  fallback = 'Unknown error',
): string => {
  return (
    cleanShort(err?.error?.message) ||
    cleanShort(err?.error?.error) ||
    cleanShort(err?.message) ||
    cleanShort(err?.statusText) ||
    (err?.status ? `HTTP ${err.status}` : null) ||
    fallback
  );
};
