// cypress.config.ts
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    experimentalRunAllSpecs: true,
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
  },
  env: {
    REACT_APP_BACKEND_URL: 'http://localhost:3040',
    ADMIN_EMAIL: 'drec@energy.org',
    ADMIN_PASSWORD: '1234Rc',
    UI_BASE_URL: 'http://localhost:4200',
    EVIDENT_TESTING_API_KEY:
      '01JY1V2ZQBBCF0Y1E015ZSKRG5.iPIXopj1fiipHXoN11u3Icp1fv1AqybIAHmoKG1rIZfpCahm1',
    EVIDENT_TESTING_EMAIL: 'irectestingabcuser9dec8@mail.com',
  },
});
