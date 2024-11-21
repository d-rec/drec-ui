import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200', // Your frontend URL
    env: {
      REACT_APP_BACKEND_URL: 'http://localhost:3040', // Your backend URL
    },
  },
});