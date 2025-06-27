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
    EVIDENT_API_KEY:
      '01JY1V3ZQBBCF0Y7E095ZSKRG3.iPIXopj9fiipHXoN97u3Icp9fv9AqybIAHmoKG8rIZfpCahm8',
    EVIDENT_EMAIL: 'irecregistrantuser9dec8@mail.com',
    EVIDENT_API_URL: 'https://sandbox.evident.dev/login',
  },
});
