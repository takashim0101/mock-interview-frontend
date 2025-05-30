// vite.config.js
// This configuration tells Vite: "Whenever the frontend tries to fetch a path that starts
// with /interview (like /interview itself), don't try to serve it from the frontend's dev server.
// Instead, send that request to http://localhost:3001."

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Configure proxy to forward API requests to the backend
    proxy: {
      '/interview': { // When the frontend requests a URL starting with /interview
        target: 'http://localhost:3001', // Forward it to the backend server
        changeOrigin: true, // Needed for virtual hosted sites
        // rewrite: (path) => path.replace(/^\/interview/, '/interview'), // Optional: uncomment if your backend route is not exactly /interview after proxying
      },
    },
  },
});