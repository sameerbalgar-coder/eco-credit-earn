import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PROMPT = `You are an anti-fraud checker for a civic garbage-reporting app.
Decide if this image is a GENUINE real-world camera photo, or if it is AI-generated, digitally rendered, an illustration/cartoon, a stock/watermarked image, or a photo of a screen.
Also say whether it shows litter/waste/garbage.
Reply ONLY with JSON: {"is_authentic": boolean, "is_ai_generated": boolean, "shows_waste": boolean, "confidence": number 0-1, "reason": "short sentence"}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Sign in required" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: ue } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (ue || !u?.user) return json({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => null);
    const image = body?.image;
    const mime = body?.mimeType ?? "image/jpeg";
    if (typeof image !== "string" || image.length < 100 || image.length > 2_000_000 || !/^image\/(jpeg|png|webp)$/.test(mime)) {
      return json({ error: "Invalid image" }, 400);
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ bypassed: true, reason: "not_configured" });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let r: Response;
    try { r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
          generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" }, responseMimeType: "application/json" },
        }),
        signal: ctrl.signal,
      },
    ); } catch { return json({ bypassed: true, reason: "timeout" }); } finally { clearTimeout(timer); }
    if (r.status === 429) return json({ bypassed: true, reason: "rate_limited" });
    if (!r.ok) {
      console.error("gemini", r.status, await r.text().catch(() => ""));
      return json({ bypassed: true, reason: "ai_unavailable" });
    }
    const d = await r.json();
    const text = (d?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join(""); if (!text) console.error("empty", JSON.stringify(d).slice(0, 500));
    let v: any;
    try { v = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return json({ bypassed: true, reason: "no_result" }); }
    return json({
      is_authentic: !!v.is_authentic && !v.is_ai_generated,
      is_ai_generated: !!v.is_ai_generated,
      shows_waste: v.shows_waste !== false,
      confidence: Number(v.confidence) || 0,
      reason: String(v.reason ?? "").slice(0, 200),
    });
  } catch (e) {
    console.error(e);
    return json({ bypassed: true, reason: "server_error" });
  }
});
