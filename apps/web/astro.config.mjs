import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import svelte from '@astrojs/svelte'

// F0: solo contenido estático. Migrar a SSR en F1 cuando agreguemos auth.
export default defineConfig({
  output: 'static',
  integrations: [mdx(), svelte()],
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  vite: {
    server: {
      allowedHosts: true,
      hmr: { overlay: false },
    },
    preview: {
      allowedHosts: true,
    },
  },
})
