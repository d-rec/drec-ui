// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  staging: true,
  production: false,
  API_URL: 'https://dev-api.drecs.org/api/',
  Explorer_URL: 'https://volta-explorer.energyweb.org',
  SENTRY_DNS:
    'https://5447c8011f4b40f4dcb8742dfbaa1c0e@o4508380579430400.ingest.de.sentry.io/4508380582576208',
  SENTRY_ENV: 'development',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
