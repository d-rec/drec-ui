import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    defaultCommandTimeout: 10000, 
    env: {
      REACT_APP_BACKEND_URL: 'http://localhost:3040',
      ADMIN_EMAIL: 'test@drec.energy',
      ADMIN_PASSWORD: '1234Rc',
      UI_BASE_URL: 'http://localhost:4200',
    },
  },
});
