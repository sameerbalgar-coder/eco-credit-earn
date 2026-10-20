import { supabase } from "@/integrations/supabase/client";

const PAUSE_KEY = "ai_photo_v2_paused_until";
export interface PhotoVerdict {
  ok: boolean;
  reason?: string;
  kind?: "fake" | "irrelevant";
  suggestion?: { waste_type?: string; estimated_kg?: number; description?: string };
}

export async function verifyPhoto(file: File): Promise<PhotoVerdict> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    if (Date.now() < Number(sessionStorage.getItem(PAUSE_KEY) || 0)) return { ok: true, reason: "unchecked" };
    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) return { ok: true, reason: "unchecked" };
    const image = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 640 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Image unavailable")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image unavailable")); };
      img.src = url;
    });
    timer = setTimeout(() => controller.abort(), 30000);
    const { data, error } = await supabase.functions.invoke("verify-report-image", {
      body: { image, mimeType: "image/jpeg" }, signal: controller.signal,
    });
    if (error || !data || data.error || data.bypassed || typeof data.is_authentic !== "boolean") {
      // Only pause when Google says the free quota is used up; other hiccups retry on the next photo.
      if (data?.reason === "rate_limited") sessionStorage.setItem(PAUSE_KEY, String(Date.now() + 60000));
      return { ok: true, reason: "unchecked" };
    }
    if (!data.is_authentic || data.is_ai_generated) return { ok: false, kind: "fake", reason: data.reason };
    if (data.shows_issue === false) return { ok: false, kind: "irrelevant", reason: data.reason };
    return { ok: true, suggestion: data.suggestion };
  } catch {
    return { ok: true, reason: "unchecked" };
  } finally { if (timer) clearTimeout(timer); }
}