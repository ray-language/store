// The static frontend is built into `dist/` and served by the raylang server under
// /app/, so the browser talks to the same origin as the API and shares the cart cookie.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/app',
  trailingSlash: 'always',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
