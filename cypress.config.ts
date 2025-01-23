import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    env: {
      REACT_APP_BACKEND_URL: 'http://localhost:3040',
      ADMIN_EMAIL: "drec@energy.org",
      ADMIN_PASSWORD: "1234Rc",
      UI_BASE_URL: 'http://localhost:4200'
    },
  },
});
