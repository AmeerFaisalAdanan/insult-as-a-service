import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // The default roast packs are JSON imported into the bundle, so the published
  // artifact carries its content and needs no filesystem or network at runtime.
  loader: { '.json': 'json' },
  // No Node-only runtime APIs; the core must run unchanged in the browser.
  platform: 'neutral',
  target: 'es2021',
  minify: false,
});
