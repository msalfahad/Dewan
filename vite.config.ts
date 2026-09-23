/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import appConfig from './src/config/app.json';

/** Builds the PWA manifest from src/config/app.json so the installed app name has one source. */
function manifestJson(): string {
  return JSON.stringify(
    {
      name: `${appConfig.nameAr} | ${appConfig.nameEn}`,
      short_name: appConfig.shortNameAr,
      description: `${appConfig.descriptionAr} — ${appConfig.descriptionEn}`,
      lang: 'ar',
      dir: 'rtl',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: appConfig.backgroundColor,
      theme_color: appConfig.themeColor,
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
}

function appNamePlugin(): Plugin {
  return {
    name: 'diwaniya-app-name',
    transformIndexHtml(html) {
      return html
        .replaceAll('%APP_NAME_AR%', appConfig.nameAr)
        .replaceAll('%APP_NAME_EN%', appConfig.nameEn)
        .replaceAll('%APP_SHORT_NAME%', appConfig.shortNameAr)
        .replaceAll('%APP_DESCRIPTION%', `${appConfig.descriptionAr} — ${appConfig.descriptionEn}`)
        .replaceAll('%THEME_COLOR%', appConfig.themeColor);
    },
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifestJson());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifestJson() });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), appNamePlugin()],
  build: {
    // The largest chunk is the lazily loaded PDF engine (pdf-lib + fontkit).
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
