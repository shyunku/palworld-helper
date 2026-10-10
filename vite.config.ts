import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true -> listen on all interfaces so the site is reachable via the PC's private IPv4 (LAN)
export default defineConfig({
  plugins: [react()],
  server: { host: true, allowedHosts: ['shyunku.kro.kr'] },
  preview: { host: true, allowedHosts: ['shyunku.kro.kr'] },
})
