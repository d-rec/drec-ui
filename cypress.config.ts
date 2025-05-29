// cypress.config.ts
import { defineConfig } from 'cypress';
import { execSync } from 'child_process'; // Import execSync

export default defineConfig({
  e2e: {
    experimentalRunAllSpecs: true,
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    setupNodeEvents(on, config) {
      on('before:spec', (spec) => {
        console.log(`Running before spec: ${spec.fileName}`);
        try {
          execSync('npm run db:reset');
          console.log('Database reset for new spec.');
        } catch (error) {
          console.error('Failed to reset database before spec:', error);
        }
      });

      on('task', {
        async resetDbAndSeedUsers() {
          console.log('Executing resetDbAndSeedUsers task...');
          try {
            execSync('npm run db:reset-and-seed');
            console.log('Database reset and seeded via task.');
            return null;
          } catch (error) {
            console.error('Failed to reset and seed database via task:', error);
            throw new Error('Database reset and seed task failed.');
          }
        },
      });

      return config;
    },
  },
  env: {
    REACT_APP_BACKEND_URL: 'http://localhost:3040',
    ADMIN_EMAIL: 'drec@energy.org',
    ADMIN_PASSWORD: '1234Rc',
    UI_BASE_URL: 'http://localhost:4200',
  },
});
