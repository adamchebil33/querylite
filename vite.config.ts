import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { APP_NAME, APP_TAGLINE } from './src/config.ts';

/** Injects branding from src/config.ts into index.html. */
function branding(): Plugin {
  return {
    name: 'branding',
    transformIndexHtml: (html) =>
      html.replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_TAGLINE%', APP_TAGLINE),
  };
}

export default defineConfig({
  plugins: [branding(), react(), tailwindcss(), cloudflare()],
});
