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
      '01BB1B2ZCCCCC0C1E015ZSEEE5.iFFXooo1foopXXox11u1Xzz1kk1AkkbZZZlaQZ1pQHfpQzpl1',
    EVIDENT_TESTING_EMAIL: 'irectestingabcuser1def1@mail.com',
  },
});
