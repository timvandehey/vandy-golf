import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import esbuild from 'esbuild';
import path from 'node:path';

const tsconfigRaw = {
  compilerOptions: {
    experimentalDecorators: true,
    useDefineForClassFields: false,
  }
};

export default defineConfig(({ command }) => {
  const isProd = command === 'build';

  return {
    plugins: [
      // Treat .js files in src/ as TS to compile legacy decorators using esbuild directly
      {
        name: 'treat-js-files-as-ts',
        async transform(code, id) {
          if (!id.match(/src\/.*\.js$/)) return null;

          const result = await esbuild.transform(code, {
            loader: 'ts',
            tsconfigRaw,
            sourcefile: id,
            sourcemap: true,
          });
          return {
            code: result.code,
            map: result.map
          };
        },
      },
      // PWA integration
      VitePWA({
        disable: !isProd,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'robots.txt'],
        manifest: {
          name: 'Golf Tracker',
          short_name: 'Golf',
          description: 'Local-first Golf Rounds and Handicap Index Tracker',
          theme_color: '#1e3a2b',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg}'],
          navigateFallbackDenylist: [/^\/api\//]
        }
      })
    ],

    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src/js'),
        '@core': path.resolve(import.meta.dirname, '../vandy-core')
      }
    },

    // Proxy API requests to dev-server.js
    server: {
      fs: {
        allow: [path.resolve(import.meta.dirname, '..')]
      },
      host: true,
      allowedHosts: ['golf', 'localhost', '127.0.0.1'],
      proxy: {
        '/api': 'http://localhost:3000'
      }
    }
  };
});
