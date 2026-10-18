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
    if (!key) return json({ error: "AI check not configured" }, 500);

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
          generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" }, responseMimeType: "application/json" },
        }),
      },
    );
    if (r.status === 429) return json({ error: "rate_limited", message: "AI check is busy. Try again in a minute." }, 429);
    if (!r.ok) {
      console.error("gemini", r.status, await r.text());
      return json({ error: "ai_unavailable", message: "AI check unavailable right now." }, 502);
    }
    const d = await r.json();
    const text = (d?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join(""); if (!text) console.error("empty", JSON.stringify(d).slice(0, 500));
    let v: any;
    try { v = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return json({ error: "ai_unavailable", message: "AI check returned no result." }, 502); }
    return json({
      is_authentic: !!v.is_authentic && !v.is_ai_generated,
      is_ai_generated: !!v.is_ai_generated,
      shows_waste: v.shows_waste !== false,
      confidence: Number(v.confidence) || 0,
      reason: String(v.reason ?? "").slice(0, 200),
    });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error", message: "Something went wrong." }, 500);
  }
});
