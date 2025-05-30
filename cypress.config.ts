import { defineConfig } from 'cypress';
import { execSync } from 'child_process';

export default defineConfig({
  e2e: {
    experimentalRunAllSpecs: true,
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    setupNodeEvents(on, config) {
      on('before:run', () => {
        console.log('All tests done. Cleaning up DB...');
        try {
          console.log('Executing: npm run test:e2e (for database cleanup)');
          execSync('npm run test:e2e', { stdio: 'inherit' });
          console.log('Database reset after all tests using npm run test:e2e.');
        } catch (error) {
          console.error('Failed to reset database after run:', error.message);
          throw error;
        }
      });

      on('task', {
        resetDbAndSeedUsers() {
          console.log('Executing resetDbAndSeedUsers task...');
          try {
            execSync(
              'npm run drop && npm run migrate && npm run seed:dummy-data',
              { stdio: 'inherit' },
            );
            console.log('Database reset and seeded via task.');
            return null;
          } catch (error) {
            console.error(
              'Failed to reset and seed database via task:',
              error.message,
            );
            throw new Error(
              'Database reset and seed task failed: ' + error.message,
            );
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
