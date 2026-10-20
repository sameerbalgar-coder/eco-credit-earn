/**
 * Google Gemini API Service for EcoCredit
 * Tailored specifically for the Gemini Free Tier:
 *
 * 1. Exponential Backoff & Jitter: Automatically handles 429 (Rate Limit) and 503 (Server Overload).
 * 2. Canvas Image Downscaling: Reduces 5-10MB mobile photos to ~50KB JPEG before sending,
 *    saving 90%+ Tokens Per Minute (TPM) and avoiding timeouts.
 * 3. Relaxed Safety Filters: Uses BLOCK_ONLY_HIGH so normal garbage, chemicals, wires,
 *    and broken waste don't trigger false-positive blocks ("finishReason: SAFETY").
 * 4. Strict JSON Mode: Uses responseMimeType: "application/json" with a strict token cap
 *    to prevent truncation and output token exhaustion.
 * 5. In-Memory Fingerprint Caching: Avoids duplicate calls for the same image.
 * 6. Graceful Degradation: Never breaks the UI or stops user submissions if the quota is reached.
 */

export interface WasteAnalysisResult {
  category: "plastic" | "organic" | "ewaste" | "metal" | "glass" | "paper" | "hazardous" | "mixed";
  confidence: number;
  estimatedWeightKg?: number;
  description: string;
  recyclable: boolean;
  ecoTip?: string;
  isAiGenerated: boolean;
  error?: string;
}

export interface HazardAnalysisResult {
  hazardType: "chemical" | "structure" | "pothole" | "wires" | "hazwaste" | "other";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  safetyPrecaution?: string;
  isAiGenerated: boolean;
  error?: string;
}

// In-memory cache to save free quota across re-renders
const analysisCache = new Map<string, any>();

/**
 * Retrieve the Gemini API key from environment variables or localStorage.
 */
export function getGeminiApiKey(): string | null {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (envKey && envKey.trim().length > 0 && envKey !== "YOUR_GEMINI_API_KEY") {
    return envKey.trim();
  }
  const storedKey = typeof window !== "undefined" ? localStorage.getItem("ECOCREDIT_GEMINI_API_KEY") : null;
  if (storedKey && storedKey.trim().length > 0) {
    return storedKey.trim();
  }
  return null;
}

/**
 * Save user custom key in localStorage if .env is not yet configured
 */
export function setGeminiApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (!key.trim()) {
      localStorage.removeItem("ECOCREDIT_GEMINI_API_KEY");
    } else {
      localStorage.setItem("ECOCREDIT_GEMINI_API_KEY", key.trim());
    }
  }
}

/**
 * Helper to safely extract and parse JSON even if Gemini includes markdown formatting (```json ... ```)
 */
function cleanAndParseJson<T>(raw: string): T {
  let cleaned = raw.trim();
  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  // Extract strictly between outer braces
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

/**
 * Downscale and compress an image file client-side using an HTML Canvas.
 * Free tier has strict Tokens-Per-Minute (TPM) limits. Sending raw 4000x3000 photos
 * wastes massive quota and triggers 429s or timeouts.
 */
export async function compressImageForGemini(
  file: File,
  maxDimension = 640,
  quality = 0.72
): Promise<{ base64Data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        // Fallback: send raw base64 if canvas decoding failed
        try {
          const rawBase64 = (reader.result as string).split(",")[1];
          resolve({ base64Data: rawBase64, mimeType: file.type || "image/jpeg" });
        } catch {
          reject(new Error("Failed to load image for compression"));
        }
      };
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            const rawBase64 = (reader.result as string).split(",")[1];
            return resolve({ base64Data: rawBase64, mimeType: file.type || "image/jpeg" });
          }

          // Draw image resized
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to lightweight JPEG data URL
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64Data = dataUrl.split(",")[1];
          resolve({ base64Data, mimeType: "image/jpeg" });
        } catch {
          // If canvas fails (e.g. security/tainted canvas), fallback to raw base64
          const rawBase64 = (reader.result as string).split(",")[1];
          resolve({ base64Data: rawBase64, mimeType: file.type || "image/jpeg" });
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Execute fetch with Exponential Backoff + Jitter.
 * Specifically handles HTTP 429 (Rate Limit) and HTTP 503 (Overloaded)
 */
async function fetchGeminiWithBackoff(
  url: string,
  payload: any,
  retries = 3,
  delayMs = 1500
): Promise<Response> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // If successful or client error (e.g. 400 bad key), return immediately
      if (response.ok) {
        return response;
      }

      // 429 = Rate Limit / Quota, 503 = Server Overloaded, 500 = Transient Google Cloud Error
      if ([429, 500, 503].includes(response.status) && attempt < retries) {
        const jitter = Math.random() * 500;
        const waitTime = delayMs * Math.pow(2, attempt) + jitter;
        console.warn(
          `[Gemini Free Tier] Rate limit / server busy (HTTP ${response.status}). Retrying in ${Math.round(waitTime)}ms (Attempt ${attempt + 1}/${retries})...`
        );
        await new Promise((res) => setTimeout(res, waitTime));
        attempt++;
        continue;
      }

      return response;
    } catch (err) {
      if (attempt < retries) {
        const jitter = Math.random() * 500;
        const waitTime = delayMs * Math.pow(2, attempt) + jitter;
        console.warn(`[Gemini Free Tier] Network hiccup. Retrying in ${Math.round(waitTime)}ms...`, err);
        await new Promise((res) => setTimeout(res, waitTime));
        attempt++;
        continue;
      }
      throw err;
    }
  }

  throw new Error("Maximum retry attempts reached for Gemini API.");
}

/**
 * Common call wrapper with candidate and finishReason inspection
 */
async function callGeminiVision(
  prompt: string,
  compressedImage: { base64Data: string; mimeType: string }
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  // Model fallback chain: try flash models supported on Google AI Studio
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: compressedImage.mimeType,
              data: compressedImage.base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Deterministic, fast, prevents hallucinations
      maxOutputTokens: 300, // Small output cap preserves tokens & speeds up generation
      responseMimeType: "application/json",
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  };

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchGeminiWithBackoff(endpoint, payload);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        console.warn(`[Gemini API] Model ${model} returned error:`, message);

        if (response.status === 429) {
          lastError = new Error("RATE_LIMIT_EXCEEDED");
          // Try next model in chain in case quota is per-model
          continue;
        }

        lastError = new Error(message);
        continue;
      }

      const json = await response.json();
      const candidate = json.candidates?.[0];

      if (!candidate) {
        throw new Error("EMPTY_RESPONSE_FROM_GEMINI");
      }

      // Check if blocked by safety filters
      if (candidate.finishReason === "SAFETY") {
        console.warn("[Gemini API] Blocked by safety filter:", candidate.safetyRatings);
        throw new Error("BLOCKED_BY_SAFETY_FILTER");
      }

      // Check if truncated
      if (candidate.finishReason === "MAX_TOKENS") {
        console.warn("[Gemini API] Response truncated by maxOutputTokens limit");
      }

      const rawText = candidate.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("EMPTY_TEXT_PARTS");
      }

      return rawText;
    } catch (err: any) {
      lastError = err;
      if (err.message === "RATE_LIMIT_EXCEEDED" || err.message === "BLOCKED_BY_SAFETY_FILTER") {
        break;
      }
    }
  }

  throw lastError || new Error("Gemini API call failed.");
}

/**
 * Classify a waste photo into one of the 8 EcoCredit categories.
 */
export async function classifyWastePhoto(file: File): Promise<WasteAnalysisResult> {
  const cacheKey = `waste_${file.name}_${file.size}_${file.lastModified}`;
  if (analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey);
  }

  const prompt = `You are an AI environmental waste auditor for EcoCredit.
Analyze this photo and identify the dominant waste type.
Categorize it strictly into ONE of: "plastic", "organic", "ewaste", "metal", "glass", "paper", "hazardous", "mixed".
Provide estimated weight in kg (realistic guess, e.g. 0.5 to 5.0).
Determine if it is recyclable (boolean).
Give a 1-sentence description and a 1-sentence eco disposal tip.

Return ONLY a JSON object with this exact schema:
{
  "category": "plastic" | "organic" | "ewaste" | "metal" | "glass" | "paper" | "hazardous" | "mixed",
  "confidence": 0.85,
  "estimatedWeightKg": 1.2,
  "description": "Brief description of the observed waste",
  "recyclable": true,
  "ecoTip": "How to dispose or recycle properly"
}`;

  try {
    const compressed = await compressImageForGemini(file, 640, 0.72);
    const rawJson = await callGeminiVision(prompt, compressed);
    const parsed = cleanAndParseJson<any>(rawJson);

    // Validate category
    const validCategories = ["plastic", "organic", "ewaste", "metal", "glass", "paper", "hazardous", "mixed"];
    const category = validCategories.includes(parsed.category) ? parsed.category : "mixed";

    const result: WasteAnalysisResult = {
      category: category as any,
      confidence: typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.85,
      estimatedWeightKg: typeof parsed.estimatedWeightKg === "number" ? parsed.estimatedWeightKg : 1.0,
      description: parsed.description || "Identified waste in uploaded photo",
      recyclable: Boolean(parsed.recyclable),
      ecoTip: parsed.ecoTip || "Clean and segregate before disposal.",
      isAiGenerated: true,
    };

    analysisCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    console.error("[Gemini AI Error]", err);
    let friendlyError = "AI classification skipped.";

    if (err.message === "NO_API_KEY") {
      friendlyError = "Gemini API key is missing. Please configure it in .env or settings.";
    } else if (err.message === "RATE_LIMIT_EXCEEDED") {
      friendlyError = "Gemini free trial rate limit reached. Please select category manually.";
    } else if (err.message === "BLOCKED_BY_SAFETY_FILTER") {
      friendlyError = "Image triggered Gemini content safety filter.";
    } else if (err.message) {
      friendlyError = `AI skipped: ${err.message}`;
    }

    return {
      category: "mixed",
      confidence: 0,
      description: "",
      recyclable: false,
      isAiGenerated: false,
      error: friendlyError,
    };
  }
}

/**
 * Analyze a hazard photo for safety risks.
 */
export async function analyzeHazardPhoto(file: File): Promise<HazardAnalysisResult> {
  const cacheKey = `hazard_${file.name}_${file.size}_${file.lastModified}`;
  if (analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey);
  }

  const prompt = `You are an AI civic hazard & safety auditor for EcoCredit.
Analyze this image and identify the civic or environmental hazard.
Select hazardType strictly from: "chemical", "structure", "pothole", "wires", "hazwaste", "other".
Select severity strictly from: "low", "medium", "high".
Provide a concise title, 1-sentence risk description, and 1 safety precaution for citizens.

Return ONLY a JSON object with this exact schema:
{
  "hazardType": "chemical" | "structure" | "pothole" | "wires" | "hazwaste" | "other",
  "severity": "low" | "medium" | "high",
  "title": "Short title",
  "description": "Clear risk explanation",
  "safetyPrecaution": "Safety advice for pedestrians and workers"
}`;

  try {
    const compressed = await compressImageForGemini(file, 640, 0.72);
    const rawJson = await callGeminiVision(prompt, compressed);
    const parsed = cleanAndParseJson<any>(rawJson);

    const validTypes = ["chemical", "structure", "pothole", "wires", "hazwaste", "other"];
    const validSeverities = ["low", "medium", "high"];

    const hazardType = validTypes.includes(parsed.hazardType) ? parsed.hazardType : "other";
    const severity = validSeverities.includes(parsed.severity) ? parsed.severity : "medium";

    const result: HazardAnalysisResult = {
      hazardType: hazardType as any,
      severity: severity as any,
      title: parsed.title || "Civic Hazard Detected",
      description: parsed.description || "Hazard identified from photo",
      safetyPrecaution: parsed.safetyPrecaution || "Maintain a safe distance.",
      isAiGenerated: true,
    };

    analysisCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    console.error("[Gemini Hazard AI Error]", err);
    let friendlyError = "AI hazard detection skipped.";

    if (err.message === "NO_API_KEY") {
      friendlyError = "Gemini API key is not configured.";
    } else if (err.message === "RATE_LIMIT_EXCEEDED") {
      friendlyError = "Gemini free rate limit reached.";
    }

    return {
      hazardType: "other",
      severity: "medium",
      title: "",
      description: "",
      isAiGenerated: false,
      error: friendlyError,
    };
  }
}

