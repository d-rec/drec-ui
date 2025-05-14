// cypress.config.ts
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    experimentalRunAllSpecs: true,
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
  },
  env: {
    REACT_APP_BACKEND_URL: 'http://localhost:3040',
    ADMIN_EMAIL: 'stageadmin@drecs.org',
    ADMIN_PASSWORD: 'pass@123',
    UI_BASE_URL: 'http://localhost:4200',
    MAILOSAUR_API_KEY: '01FD0WG620yCxzdEtTRSTxXuX18DUUij',
    MAILOSAUR_SERVER_ID: 'ceuazndf',
  },
});
