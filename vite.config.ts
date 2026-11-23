import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    dyadComponentTagger(), 
    react(),
    VitePWA({
      // "prompt" (NOT "autoUpdate"): with "prompt" a newly-detected service
      // worker installs silently and WAITS. It never calls skipWaiting() /
      // clientsClaim(), so it can never take over and reload the live page.
      // Updates are applied only on the next full load / app reopen.
      // "autoUpdate" was the cause of random mid-gig refreshes: the SW update
      // check can fire at any moment, and on iPadOS standalone PWAs claiming a
      // client reloads the PWA to apply the new version.
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.svg"],
      manifest: {
        name: "Gig Studio Pro",
        short_name: "GigStudioPro",
        description: "Professional Performance Management for Musicians",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "apple-touch-icon.svg",
            sizes: "180x180",
            type: "image/svg+xml",
          },
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  optimizeDeps: {
    // Pre-bundle the heavy, lazily-loaded route dependencies at server start so
    // Vite never discovers a new dependency mid-session and triggers a
    // full-page reload ("new dependencies optimized, reloading") during a gig.
    include: [
      "react-pdf",
      "pdfjs-dist",
      "@react-spring/web",
      "@use-gesture/react",
      "react-beautiful-dnd",
      "embla-carousel-react",
      "recharts",
      "meyda",
      "web-audio-beat-detector",
      "tone",
    ],
  },
}));