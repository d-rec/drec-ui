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
    MAILSLURP_API_KEY:
      'ce55cc6185b8994ab82b54534774314d7fe41a64e9a0c096e63681fa960eb0eb',
  },
});
