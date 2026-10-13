import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Optional public WalletConnect Cloud project id, supplied at build time. It is inlined as a
// constant so a build without one drops the WalletConnect connector and its chunk entirely.
const walletConnectProjectId = (process.env.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim();

// Relative base: the export must work from an IPFS gateway subpath or an ENS name.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __WALLETCONNECT_PROJECT_ID__: JSON.stringify(walletConnectProjectId) },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'viem', 'wagmi', '@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
