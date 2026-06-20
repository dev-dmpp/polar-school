import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import svelte from '@astrojs/svelte'

// F0: solo contenido estático. Migrar a SSR en F1 cuando agreguemos auth.
export default defineConfig({
  output: 'static',
  integrations: [mdx(), svelte()],
  // Astro 5: `server.allowedHosts` es lo que aplica tanto a `astro dev`
  // como a `astro preview`. (NO `vite.preview.allowedHosts` — eso no se propaga.)
  // Acepta string con prefijo "." como regex (match por dominio).
  server: {
    host: '127.0.0.1',
    port: 3000,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.trycloudflare.com',     // match *.trycloudflare.com (Cloudflare quick tunnels)
      '.ngrok-free.app',         // ngrok free tier
      '.ngrok.io',               // ngrok legacy
      '.loca.lt',                // localtunnel
    ],
  },
  vite: {
    server: {
      hmr: { overlay: false },
    },
  },
})
