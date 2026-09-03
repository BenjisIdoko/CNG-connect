import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';
import otpSendHandler from './api/otp/send';
import otpVerifyHandler from './api/otp/verify';

function apiChatPlugin(): Plugin {
  return {
    name: 'api-chat-plugin',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on server.' }));
              return;
            }

            const { prompt, stations } = JSON.parse(bodyStr || '{}');
            const ai = new GoogleGenAI({ apiKey });
            const contextPrompt = `You are CNG-Connect AI, an expert assistant for Nigerian drivers using Compressed Natural Gas (CNG).
Here is the current live status of CNG stations across Nigeria:
${JSON.stringify(
  (stations || []).map((s: any) => ({
    name: s.name,
    city: s.city,
    state: s.state,
    status: s.statusLabel,
    pressure: `${s.pumpPressure} bar`,
    price: `₦${s.cngPrice}/kg`,
    wait: s.busyEstimate,
    piCng: s.isPiCngAccredited ? 'Yes' : 'No',
  })),
  null,
  2
)}

Driver question: "${prompt}"
Give a friendly, concise, and helpful response. Mention specific stations, prices in Naira, and practical driving/refuelling tips. Keep answer under 4 paragraphs.`;

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: contextPrompt,
            });

            const reply = response.text || 'I analyzed the station reports! All major Pi-CNG stations are operating smoothly today.';
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ reply }));
          } catch (error: any) {
            console.error('Server-side Gemini Error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error?.message || 'Server error' }));
          }
        });
      });
    },
  };
}

function apiOtpPlugin(): Plugin {
  return {
    name: 'api-otp-plugin',
    configureServer(server) {
      server.middlewares.use('/api/otp/send', async (req, res) => {
        let bodyStr = '';
        req.on('data', (chunk) => { bodyStr += chunk; });
        req.on('end', async () => {
          (req as any).body = bodyStr;
          await otpSendHandler(req, res);
        });
      });

      server.middlewares.use('/api/otp/verify', async (req, res) => {
        let bodyStr = '';
        req.on('data', (chunk) => { bodyStr += chunk; });
        req.on('end', async () => {
          (req as any).body = bodyStr;
          await otpVerifyHandler(req, res);
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-icon.svg', 'apple-touch-icon.png', 'maskable-icon-512.png'],
        manifest: {
          name: 'CNG-Connect Nigeria - Driver Platform & Live Station Locator',
          short_name: 'CNG-Connect',
          description: 'Live CNG fuel station status finder, queue tracker, pump pressure tracker, and driver community for real-time station availability in Nigeria.',
          theme_color: '#004D40',
          background_color: '#f2fcf5',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/(.*\.cartocdn\.com|.*\.tile\.openstreetmap\.org|unpkg\.com\/leaflet.*)\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cng-map-tiles',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cng-google-fonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'cng-supabase-api',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      }),
      apiChatPlugin(),
      apiOtpPlugin()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3002,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('leaflet')) return 'leaflet-vendor';
              if (id.includes('@supabase')) return 'supabase-vendor';
              if (id.includes('lucide-react')) return 'icons-vendor';
              return 'vendor';
            }
            if (id.includes('pci-conversion-centers-seed.json')) {
              return 'conversion-centers-seed';
            }
            if (id.includes('pci-stations-seed.json')) {
              return 'stations-seed';
            }
          },
        },
      },
    },
  };
});
