// Vision extraction for the AI menu scanner — server-side only.
// Uses an OpenAI-compatible chat-completions endpoint with image input.
//
// Env vars:
//   VISION_API_URL   e.g. https://api.openai.com/v1
//                    (Azure OpenAI: https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-10-21)
//                    (OpenRouter: https://openrouter.ai/api/v1)
//   VISION_API_KEY   the API key
//   VISION_MODEL     e.g. gpt-4o-mini (default). Ignored by Azure (deployment is in the URL).

export function visionIsConfigured(): boolean {
  return Boolean(process.env.VISION_API_KEY);
}

export interface ExtractedItem {
  name: string;
  description: string | null;
  price: number;
  category: string;
}

const PROMPT = `You are a menu digitizer. Look at this restaurant menu photo and extract every food/drink item.

Return ONLY a JSON array, no markdown fences, no commentary. Each element:
{"name": string, "description": string or null, "price": number, "category": string}

Rules:
- "price" is a plain number, no currency symbols ("Rs 450" -> 450, "1,250" -> 1250).
- "category" is the menu section heading the item sits under (e.g. "BBQ", "Beverages", "Desi"). If no section is visible, use "General".
- "description" is the short dish description if printed, else null.
- Skip non-item text: addresses, phone numbers, slogans, timings, delivery info.
- NEVER put email addresses, phone numbers, URLs, or social media handles in ANY field.
- If an item's price is unreadable, omit that item.
- Keep names exactly as printed (Roman Urdu / English as-is).`;

export async function extractMenuFromImage(imageUrl: string): Promise<ExtractedItem[]> {
  const base = (process.env.VISION_API_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.VISION_MODEL || 'gpt-4o-mini';
  const key = process.env.VISION_API_KEY as string;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vision API error (${res.status}): ${body.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = j.choices?.[0]?.message?.content ?? '';
  return parseItems(text);
}

// Defensive cleanup: the model sometimes leaks contact info printed on the
// menu (email / phone / url) into a field. Strip it — it never belongs there.
function stripContact(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/\+?\d[\d\s-]{7,}\d/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseItems(text: string): ExtractedItem[] {
  const clean = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  let arr: unknown;
  try {
    arr = JSON.parse(clean);
  } catch {
    throw new Error('The AI returned an unreadable response. Try a clearer photo.');
  }
  if (!Array.isArray(arr)) throw new Error('The AI returned an unexpected format.');
  const items: ExtractedItem[] = [];
  for (const r of arr) {
    const row = r as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const price = Number(row.price);
    if (!name || !Number.isFinite(price) || price < 0) continue;
    const category =
      typeof row.category === 'string' && row.category.trim() ? row.category.trim() : 'General';
    const description =
      typeof row.description === 'string' && row.description.trim()
        ? stripContact(row.description) || null
        : null;
    items.push({ name: stripContact(name), description, price: Math.round(price * 100) / 100, category });
  }
  return items;
}
