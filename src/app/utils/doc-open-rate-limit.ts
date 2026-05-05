/**
 * Hard rate-limit shared across every code path that can trigger a
 * browser download dialog or PDF iframe load:
 *
 *   - AssetService.viewPdf
 *   - AssetService.viewPicture
 *   - reviewer-workbench.download()
 *   - reviewer-workbench.ensureBlobUrlFor()
 *
 * If anything fires more often than MIN_INTERVAL_MS, subsequent calls
 * are dropped silently with a console.warn. This is a safety net —
 * not a solution to whatever is looping upstream.
 *
 * Last-resort defense against the download-flood bug where Firefox
 * gets stuck in an infinite dialog cycle the user can only escape by
 * killing the browser.
 */

const MIN_INTERVAL_MS = 60_000; // 60s

let lastFiredAt = 0;
let lastDroppedLoggedAt = 0;

/**
 * Returns true if the caller is allowed to fire (and records the time);
 * returns false if the caller should drop because the last fire was too
 * recent.
 */
export function canFireDocOpen(label: string): boolean {
  const now = Date.now();
  const since = now - lastFiredAt;
  if (since < MIN_INTERVAL_MS) {
    // Throttle the warn itself so it doesn't flood the console either.
    if (now - lastDroppedLoggedAt > 1000) {
      // eslint-disable-next-line no-console
      console.warn(
        `[doc-open-rate-limit] dropped ${label} — last fire was ${Math.round(since / 1000)}s ago, min interval ${MIN_INTERVAL_MS / 1000}s`,
      );
      lastDroppedLoggedAt = now;
    }
    return false;
  }
  lastFiredAt = now;
  return true;
}

/** Test/recover hook — let an explicit user reset clear the limiter. */
export function resetDocOpenRateLimit(): void {
  lastFiredAt = 0;
}
