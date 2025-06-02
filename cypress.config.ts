// cypress.config.ts
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    experimentalRunAllSpecs: true,
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
  },
  env: {
    MODE: 'test',
    REACT_APP_BACKEND_URL: 'http://localhost:3040',
    ADMIN_EMAIL: 'drec@energy.org',
    ADMIN_PASSWORD: '1234Rc',
    UI_BASE_URL: 'http://localhost:4200',
  },
});
