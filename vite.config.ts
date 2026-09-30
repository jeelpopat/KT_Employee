import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/cld-api': {
        target: 'https://api.cloudinary.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cld-api/, ''),
        headers: {
          Authorization: 'Basic ' + Buffer.from('736137837225317:IHu_UDOyaodGqTUdWO2SwLzFRGA').toString('base64')
        }
      }
    }
  }
})

