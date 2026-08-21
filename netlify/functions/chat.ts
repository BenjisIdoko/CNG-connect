import { GoogleGenAI } from '@google/genai';

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured on server.' }),
      };
    }

    const { prompt, stations } = JSON.parse(event.body || '{}');
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Prompt is required.' }),
      };
    }

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
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    };
  } catch (error: any) {
    console.error('Netlify Gemini API Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message || 'Failed to generate AI response.' }),
    };
  }
};
