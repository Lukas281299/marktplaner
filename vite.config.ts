import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standard-Konfiguration für Vite. Mehr wird für dieses Projekt nicht gebraucht.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
});
