import imageCompression from 'browser-image-compression';
import { GoogleGenAI } from '@google/genai';
import type { PrescriptionScanResult } from '../types';

// Resolve the Gemini key at call time. Vite replaces import.meta.env.VITE_* at
// build time, so the var must exist in the build environment (Vercel: Project
// Settings > Environment Variables, then redeploy) or the call below throws.
function getGeminiApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key || !key.trim()) {
    throw new Error(
      'Gemini API key is missing. Set VITE_GEMINI_API_KEY in your environment ' +
        '(Vercel: Project Settings > Environment Variables, then redeploy).'
    );
  }
  return key.trim();
}

const GEMINI_PROMPT = `You are a medical prescription OCR and salt-analysis AI specialized for the Pakistani pharmaceutical market.
Analyze the prescription image and extract every medicine written on it with exact accuracy.

Return ONLY a valid JSON object — no markdown fences, no commentary — matching this exact schema:
{
  "diseaseEn": "the exact diagnosis / disease stated or clearly implied on the prescription, in English",
  "diseaseUr": "the same diagnosis accurately translated into Urdu",
  "medications": [
    {
      "originalBrand": "the exact brand name and strength as written (e.g. Augmentin 625mg)",
      "purposeEn": "precise English description of what this medicine is used for, tied to the diagnosis",
      "purposeUr": "accurate Urdu translation of that purpose",
      "dosageEn": "exact dosage instructions in English as written (frequency, duration, with/after food)",
      "dosageUr": "the same dosage instructions accurately in Urdu",
      "altMed": "the cheapest therapeutically-equivalent generic salt available in Pakistan (salt name + typical brand, e.g. Co-Amoxiclav 625mg / Moxaclav)",
      "altPrice": estimated PKR retail price for that generic (number only),
      "originalPrice": estimated PKR retail price for the original brand (number only),
      "savings": integer percentage saved by choosing the generic (number only, 0-100)
    }
  ]
}

Rules:
- Extract every medication you can read. Never invent medicines that are not on the prescription.
- If a field cannot be read from the image, use an empty string "" for text fields; for prices use 0.
- If the diagnosis cannot be determined, set diseaseEn to "General Prescription" and diseaseUr to "عام نسخہ".
- altMed MUST be a real, registered generic equivalent sold in Pakistan, not a made-up name.
- Keep all text fields concise (max ~20 words). Output must be valid JSON parseable by JSON.parse.`;

async function compressImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    });
  } catch {
    return file;
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeMedications(parsed: Record<string, unknown>) {
  const meds = Array.isArray(parsed.medications) ? parsed.medications : [];
  return meds
    .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
    .map((m) => ({
      originalBrand: String(m.originalBrand ?? ''),
      purposeEn: String(m.purposeEn ?? ''),
      purposeUr: String(m.purposeUr ?? ''),
      dosageEn: String(m.dosageEn ?? ''),
      dosageUr: String(m.dosageUr ?? ''),
      altMed: String(m.altMed ?? ''),
      altPrice: Number(m.altPrice) || 0,
      originalPrice: Number(m.originalPrice) || 0,
      savings: Math.max(0, Math.min(100, Math.round(Number(m.savings)) || 0)),
    }))
    .filter((m) => m.originalBrand || m.altMed);
}

function parseGeminiText(text: string): PrescriptionScanResult {
  // Strip markdown fences if the model added them despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const medications = normalizeMedications(parsed);
  if (medications.length === 0) {
    throw new Error('AI response contained no medications');
  }
  return {
    diseaseEn: String(parsed.diseaseEn ?? 'General Prescription'),
    diseaseUr: String(parsed.diseaseUr ?? 'عام نسخہ'),
    medications,
    scanned_at: new Date().toISOString(),
  };
}

export async function scanPrescription(
  file: File | null
): Promise<PrescriptionScanResult> {
  if (!file) {
    throw new Error('No image was provided for scanning.');
  }
  const apiKey = getGeminiApiKey();

  const compressed = await compressImage(file);
  const base64 = await fileToBase64(compressed);
  const mimeType = compressed.type || 'image/jpeg';

  const ai = new GoogleGenAI({ apiKey });

  let text = '';
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        { text: GEMINI_PROMPT },
        { inlineData: { mimeType, data: base64 } },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
      },
    });
    text = response.text ?? '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg);
    if (isRateLimit) {
      throw new Error(
        'AI system is busy. Please wait 10-15 seconds and click Retry.\n' +
          'اے آئی سسٹم مصروف ہے۔ براہ کرم ۱۰-۱۵ سیکنڈ انتظار کریں اور دوبارہ کوشش کریں۔'
      );
    }
    throw new Error('AI scan failed. Please try again with a clearer image.');
  }

  try {
    return parseGeminiText(text);
  } catch {
    throw new Error('The AI returned a response that could not be read as valid data.');
  }
}
