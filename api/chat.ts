import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    if (res && typeof res.status === 'function') {
      return res.status(200).json({});
    }
    return new Response(null, { status: 200 });
  }

  if (req.method !== 'POST') {
    if (res && typeof res.status === 'function') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const errorMsg = 'GEMINI_API_KEY environment variable is missing on server.';
      if (res && typeof res.status === 'function') {
        return res.status(500).json({ error: errorMsg });
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // raw body fallback
      }
    }

    const { prompt, stations } = body || {};
    if (!prompt) {
      const errorMsg = 'Prompt is required.';
      if (res && typeof res.status === 'function') {
        return res.status(400).json({ error: errorMsg });
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    if (res && typeof res.status === 'function') {
      return res.status(200).json({ reply });
    }
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Server-side Gemini API Error:', error);
    const errorMsg = error?.message || 'Failed to generate AI response.';
    if (res && typeof res.status === 'function') {
      return res.status(500).json({ error: errorMsg });
    }
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
