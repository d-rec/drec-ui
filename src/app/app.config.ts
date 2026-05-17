import { APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { Router } from '@angular/router';
import * as Sentry from '@sentry/angular';
import { environment } from 'src/environments/environment';
// Stage doesn't need Sentry telemetry — we debug it via direct DB/pod-log
// access, not the Sentry dashboard. Skipping init also kills the recurring
// CORS noise developers see when tracker shields block Sentry's ingest.
// Prod keeps it on so real user-facing errors still land in the dashboard.
if (environment.production) {
  Sentry.init({
    dsn: environment.SENTRY_DNS,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    tracePropagationTargets: [/^\/api/],
    environment: environment.SENTRY_ENV,
  });
}

export const appConfig: any = {
  providers: [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler(),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ],
};
