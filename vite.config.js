import { defineConfig } from 'vite';

// "base: './'" makes every link relative, so the app works no matter what
// web address GitHub Pages gives it.
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: { target: 'es2022' },
});
