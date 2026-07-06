import { Injectable, OnDestroy } from '@angular/core';
import { environment } from 'src/environments/environment';

interface BufferedEvent {
  level: 'log' | 'info' | 'warn' | 'error';
  time: string;
  message: string;
  args?: unknown[];
  stack?: string;
}

/**
 * Pipes browser console.warn / console.error / window.onerror /
 * unhandledrejection into the drec-api pod's stdout, so a maintainer
 * tailing the API logs can see the user's browser state live without the
 * user having to F12 → screenshot → paste.
 *
 * Strict opt-in: only fires on stage AND when the URL has `?debug=1`. Prod
 * never activates. Each session gets a short random id so multiple tabs
 * don't collide in the log stream.
 *
 * Levels captured: warn + error only (no console.log spam). Plus uncaught
 * exceptions and unhandled promise rejections.
 *
 * Batched delivery: events are buffered and POSTed every 3s or when 50
 * events accumulate, whichever comes first. The wrapper preserves the
 * original console behaviour — the message still appears in the browser
 * console as well, so this is purely additive.
 */
@Injectable({ providedIn: 'root' })
export class BrowserConsolePipeService implements OnDestroy {
  private readonly enabled: boolean;
  private readonly sessionId: string;
  private readonly endpoint: string;
  private buffer: BufferedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly FLUSH_INTERVAL_MS = 3000;
  private readonly FLUSH_THRESHOLD = 50;
  private readonly originalConsole = {
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  private installed = false;

  constructor() {
    const isStage = !!environment.staging;
    const debugFlag =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('debug');
    this.enabled = isStage && debugFlag;
    this.sessionId =
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6);
    this.endpoint = `${environment.API_URL}debug/browser-log`;

    if (this.enabled) {
      this.install();
    }
  }

  private install(): void {
    if (this.installed) return;
    this.installed = true;

    console.warn = (...args: unknown[]) => {
      this.originalConsole.warn(...args);
      this.capture('warn', args);
    };
    console.error = (...args: unknown[]) => {
      this.originalConsole.error(...args);
      this.capture('error', args);
    };

    window.addEventListener('error', (ev) => {
      this.capture('error', [ev.message], ev.error?.stack);
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const reason = (ev as PromiseRejectionEvent).reason;
      this.capture('error', ['unhandledrejection', reason], reason?.stack);
    });

    this.flushTimer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);

    // Beacon-flush on page unload so the last events aren't lost.
    window.addEventListener('beforeunload', () => this.flush(true));

    // Mark the pipe as live in the browser console so the user knows
    // it's actually running.
    this.originalConsole.warn(
      `[browser-console-pipe] enabled, session=${this.sessionId}, endpoint=${this.endpoint}`,
    );
  }

  private capture(
    level: BufferedEvent['level'],
    args: unknown[],
    stack?: string,
  ): void {
    if (!this.enabled) return;
    const message =
      args.length > 0
        ? args
            .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
            .join(' ')
        : '';
    this.buffer.push({
      level,
      time: new Date().toISOString(),
      message,
      stack,
    });
    if (this.buffer.length >= this.FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  private flush(usingBeacon = false): void {
    if (!this.buffer.length) return;
    const events = this.buffer.splice(0);
    let email: string | undefined;
    try {
      const u = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
      email = u?.email;
    } catch {
      /* ignore */
    }
    const payload = JSON.stringify({
      sessionId: this.sessionId,
      url: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent,
      email,
      events,
    });
    try {
      if (usingBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          this.endpoint,
          new Blob([payload], { type: 'application/json' }),
        );
        return;
      }
      void fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        /* swallow — debug pipe must never break the page */
      });
    } catch {
      /* swallow */
    }
  }

  ngOnDestroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
