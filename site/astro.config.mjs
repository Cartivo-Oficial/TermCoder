// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://cartivo-oficial.github.io',
  base: '/TermCoder/',
  output: 'static',

  build: {
    format: 'file'
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});