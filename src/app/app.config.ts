import { APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { Router } from '@angular/router';
import * as Sentry from "@sentry/angular";

Sentry.init({
    dsn:"https://5447c8011f4b40f4dcb8742dfbaa1c0e@o4508380579430400.ingest.de.sentry.io/4508380582576208",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // autoSessionTracking: false, 
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^https?:\/\/localhost:\d+/],
    environment: 'development', 
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

export const appConfig: any = {
  providers: [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: false, 
      }),
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
