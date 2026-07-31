import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-api-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { programName, customApiKey } = req.body || {};
    if (!programName || typeof programName !== 'string' || !programName.trim()) {
      return res.status(400).json({ error: 'Sila masukkan nama program terlebih dahulu.' });
    }

    const cleanName = programName.trim();
    
    // Priority: customApiKey from body > x-gemini-api-key header > process.env.GEMINI_API_KEY
    const apiKey = 
      customApiKey || 
      (req.headers['x-gemini-api-key'] as string) || 
      process.env.GEMINI_API_KEY;

    let objectives = '';

    if (apiKey && apiKey.trim()) {
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey.trim(),
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: `Anda adalah pembantu pengurusan sekolah di Malaysia. Sila jana 2 hingga 3 objektif program yang ringkas, profesional, dan padat (dalam Bahasa Melayu) berdasarkan tajuk program berikut: "${cleanName}".

Garis Panduan Penting:
1. Tulis dalam bentuk senarai bernombor (numbering) bermula dengan angka 1 dan seterusnya (cth: "1. ", "2. ", "3. "). Jangan gunakan simbol "- " atau bullet points lain.
2. Setiap objektif mestilah ringkas, padat dan mudah difahami (1 baris setiap satu).
3. Terus berikan senarai objektif tersebut tanpa sebarang pengenalan, penutup, atau hiasan teks lain.

Contoh Output:
1. Meningkatkan kesedaran murid tentang kepentingan keselamatan jalan raya.
2. Memupuk semangat kerjasama dan kepimpinan dalam kalangan peserta.
3. Melahirkan pelajar yang berdisiplin dan bertanggungjawab.`,
            });

            if (response && response.text) {
              objectives = response.text.trim();
              break;
            }
          } catch (modelErr) {
            console.warn(`Model ${modelName} failed on Vercel:`, modelErr);
          }
        }
      } catch (genAiErr) {
        console.error('GenAI Initialization error on Vercel:', genAiErr);
      }
    }

    // Fallback if no objectives were generated (e.g. key missing or API rate-limited)
    if (!objectives) {
      objectives = [
        `1. Meningkatkan pemahaman dan kesedaran murid tentang kepentingan aktiviti dalam "${cleanName}".`,
        `2. Memupuk semangat kerjasama, disiplin, dan penglibatan aktif semua peserta yang menyertai "${cleanName}".`,
        `3. Melahirkan pelajar yang seimbang dari aspek intelek, rohani, emosi, dan jasmani melalui program ini.`
      ].join('\n');
    }

    return res.status(200).json({ objectives });
  } catch (error: any) {
    console.error('Vercel API error:', error);
    const fallbackName = (req.body?.programName || 'Program').trim();
    const fallbackObjectives = [
      `1. Meningkatkan pemahaman dan kesedaran murid tentang kepentingan aktiviti dalam "${fallbackName}".`,
      `2. Memupuk semangat kerjasama, disiplin, dan penglibatan aktif semua peserta yang menyertai "${fallbackName}".`,
      `3. Melahirkan pelajar yang seimbang dari aspek intelek, rohani, emosi, dan jasmani melalui program ini.`
    ].join('\n');

    return res.status(200).json({ objectives: fallbackObjectives });
  }
}
