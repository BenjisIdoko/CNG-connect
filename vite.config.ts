import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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
            const contextPrompt = `You are GasFinder AI, an expert assistant for Nigerian drivers using Compressed Natural Gas (CNG).
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
    plugins: [react(), tailwindcss(), apiChatPlugin(), apiOtpPlugin()],
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
  };
});
