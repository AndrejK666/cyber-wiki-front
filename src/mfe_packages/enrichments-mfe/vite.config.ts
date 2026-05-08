// @cpt-dod:cpt-frontx-dod-mfe-isolation-mf-vite-plugin:p1
// @cpt-flow:cpt-frontx-flow-mfe-isolation-build-v2:p2
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { frontxMfGts } from '@cyberfabric/screensets/build/mf-gts';
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Copies mfe.src.json → mfe.json before build so that frontxMfGts() (which
 * runs in closeBundle) can enrich it with hashed asset paths and shared dep
 * versions. Only mfe.src.json is committed; mfe.json is gitignored.
 */
function seedMfeJson(): import('vite').Plugin {
  return {
    name: 'seed-mfe-json',
    buildStart() {
      const root = join(import.meta.dirname);
      const src = join(root, 'mfe.src.json');
      const dst = join(root, 'mfe.json');
      if (existsSync(src)) {
        copyFileSync(src, dst);
      }
    },
  };
}

const sharedDeps = [
  'react',
  'react-dom',
  '@cyberfabric/react',
  '@cyberfabric/framework',
  '@cyberfabric/state',
  '@cyberfabric/screensets',
  '@cyberfabric/api',
  '@cyberfabric/i18n',
  '@tanstack/react-query',
  '@reduxjs/toolkit',
  'react-redux',
];

export default defineConfig({
  plugins: [
    seedMfeJson(),
    react(),
    federation({
      name: 'enrichmentsMfe',
      filename: 'remoteEntry.js',
      exposes: {
        './lifecycle': './src/lifecycle.tsx',
      },
      // Empty shared config — MF 2.0's shared dep mechanism is bypassed.
      // Shared deps are externalized via rollupOptions.external and provided
      // at runtime by the handler's bare-specifier rewriting.
      shared: {},
      // mf-manifest.json must be generated alongside remoteEntry.js so that
      // MfeHandlerMF can discover expose chunk paths without regex-parsing the bundle.
      manifest: true,
    }),
    frontxMfGts(),
  ],
  build: {
    target: 'esnext',
    modulePreload: false,
    /** Default Vite prod behavior; MfeHandlerMF integration test asserts compatibility. */
    minify: true,
    cssCodeSplit: true,
    rollupOptions: {
      // Preserve bare specifiers for shared deps in the output chunks.
      // The handler rewrites these to blob URLs at runtime.
      external: sharedDeps,
    },
  },
});
