import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173 },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Keep shared React dependencies out of the optional 3D chunk.
          // Otherwise the storefront preloads all of Three.js just to obtain React.
          if (
            /node_modules\/(react|react-dom|scheduler)\//.test(
              id.replace(/\\/g, '/')
            )
          )
            return 'react-vendor'
          if (id.includes('three') || id.includes('@react-three'))
            return 'three-vendor'
          if (id.includes('@supabase')) return 'supabase-vendor'
          return undefined
        },
      },
    },
  },
})
