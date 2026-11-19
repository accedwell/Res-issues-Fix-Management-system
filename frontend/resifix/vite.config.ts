import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Listen on the local network too, so phones and laptops on the same Wi-Fi can open the app.
  server: { host: true },
})
