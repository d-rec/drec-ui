// cypress.config.ts
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    experimentalRunAllSpecs: true,
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    setupNodeEvents(on, config) {
      on('before:spec', (spec) => {
        console.log(`Running before spec: ${spec.fileName}`);
        // Example: Run a shell script to reset your database
        // Make sure your backend has a script for this (e.g., `npm run db:reset`)
        execSync('npm run db:reset');
        console.log('Database reset for new spec.');
      });
      // ... other tasks
    },
  },
  env: {
    REACT_APP_BACKEND_URL: 'http://localhost:3040',
    ADMIN_EMAIL: 'drec@energy.org',
    ADMIN_PASSWORD: '1234Rc',
    UI_BASE_URL: 'http://localhost:4200',
  },
});
function execSync(arg0: string) {
  throw new Error('Function not implemented.');
}
