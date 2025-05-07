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
    MAILISK_API_KEY: 'j2FPLginP1fG0ZbSXVFuxuEK7yPX-nGGFRAg9szmxJQ',
    MAILISK_NAMESPACE: 'ra92so6aiieb',
  },
});
