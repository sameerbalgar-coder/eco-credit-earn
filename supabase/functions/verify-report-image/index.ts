import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PROMPT = `You are an anti-fraud checker for a civic issue reporting app in India. Citizens report:
- waste: litter, garbage heaps, illegal dumping, overflowing bins, construction debris
- road: potholes, broken roads, open/missing manholes, waterlogging
- tree_fall: fallen trees or branches blocking roads or on wires
- electrical: fallen/leaning electric poles, dangling or sparking wires, damaged transformers
- spill: oil, fuel or chemical spills
- structure: damaged walls, buildings, bridges, footpaths
- other_hazard: any other public safety risk
Decide if this image is a GENUINE real-world camera photo, or if it is AI-generated, digitally rendered, an illustration/cartoon, a stock/watermarked image, or a photo of a screen. Low quality, blur, night shots or messy framing are normal for genuine phone photos — do not flag them.
Also say whether it shows any of the civic issues above, and which category.
Reply ONLY with JSON: {"is_authentic": boolean, "is_ai_generated": boolean, "shows_issue": boolean, "issue_category": "waste|road|tree_fall|electrical|spill|structure|other_hazard|none", "confidence": number 0-1, "reason": "short sentence", "waste_type": "plastic|organic|ewaste|metal|glass|paper|hazardous|mixed", "estimated_kg": number, "description": "one short sentence describing what is visible"}
For waste_type: use "hazardous" for non-garbage hazards (road, tree, electrical, spill, structure), otherwise the dominant waste material.`;

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const log = async (outcome: string, reason?: string) => {
      try { await admin.from("ai_usage_logs").insert({ user_id: u.user.id, model: "gemini-3.5-flash", outcome, reason: reason?.slice(0, 200) ?? null }); } catch { /* never block */ }
    };
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ bypassed: true, reason: "not_configured" });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    let r: Response;
    try { r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
          generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" }, responseMimeType: "application/json" },
        }),
        signal: ctrl.signal,
      },
    ); } catch { await log("bypassed", "timeout"); return json({ bypassed: true, reason: "timeout" }); } finally { clearTimeout(timer); }
    if (r.status === 429) { await log("bypassed", "rate_limited"); return json({ bypassed: true, reason: "rate_limited" }); }
    if (!r.ok) {
      console.error("gemini", r.status, await r.text().catch(() => ""));
      await log("bypassed", "ai_unavailable");
      return json({ bypassed: true, reason: "ai_unavailable" });
    }
    const d = await r.json();
    const text = (d?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join(""); if (!text) console.error("empty", JSON.stringify(d).slice(0, 500));
    let v: any;
    try { v = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { await log("bypassed", "no_result"); return json({ bypassed: true, reason: "no_result" }); }
    const authentic = !!v.is_authentic && !v.is_ai_generated;
    await log(authentic ? "authentic" : "flagged_fake", String(v.reason ?? ""));
    return json({
      is_authentic: !!v.is_authentic && !v.is_ai_generated,
      is_ai_generated: !!v.is_ai_generated,
      shows_waste: v.shows_issue !== false,
      shows_issue: v.shows_issue !== false,
      issue_category: String(v.issue_category ?? "none").slice(0, 30),
      confidence: Number(v.confidence) || 0,
      reason: String(v.reason ?? "").slice(0, 200),
      suggestion: {
        waste_type: ["plastic","organic","ewaste","metal","glass","paper","hazardous","mixed"].includes(v.waste_type) ? v.waste_type : null,
        estimated_kg: Number.isFinite(Number(v.estimated_kg)) && Number(v.estimated_kg) > 0 ? Math.min(1000, Math.round(Number(v.estimated_kg))) : null,
        description: typeof v.description === "string" ? v.description.slice(0, 200) : null,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ bypassed: true, reason: "server_error" });
  }
});
