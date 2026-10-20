import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Models whose free daily allowance ran out (UTC date), so later photos skip them instantly.
const exhausted = new Map<string, string>();

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
STEP 1 — AUTHENTICITY: Decide if this image is a GENUINE real-world camera photo, or if it is AI-generated, digitally rendered, an illustration/cartoon, a stock/watermarked image, or a photo of a screen. Low quality, blur, night shots or messy framing are normal for genuine phone photos — do not flag them.
STEP 2 — CATEGORY: Only if real, decide whether it clearly shows one of the civic issues above. Selfies, people, pets, food, indoor rooms, documents, screenshots, clean scenery or unrelated objects are NOT civic issues: set shows_issue=false and issue_category="none".
Reply ONLY with JSON: {"is_authentic": boolean, "is_ai_generated": boolean, "shows_issue": boolean, "issue_category": "waste|road|tree_fall|electrical|spill|structure|other_hazard|none", "confidence": number 0-1, "reason": "short sentence", "waste_type": "plastic|organic|ewaste|metal|glass|paper|hazardous|mixed", "estimated_kg": number, "description": "one short sentence describing what is visible"}
For waste_type: use "hazardous" for non-garbage hazards (road, tree, electrical, spill, structure), otherwise the dominant waste material.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Signed-out or expired sessions skip the AI check (no Gemini call) instead of erroring.
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ bypassed: true, reason: "signed_out" });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error: ce } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (ce || !userId || claims?.claims?.role !== "authenticated") return json({ bypassed: true, reason: "signed_out" });
    const u = { user: { id: userId } };

    const body = await req.json().catch(() => null);
    const image = body?.image;
    const mime = body?.mimeType ?? "image/jpeg";
    if (typeof image !== "string" || image.length < 100 || image.length > 2_000_000 || !/^image\/(jpeg|png|webp)$/.test(mime)) {
      return json({ error: "Invalid image" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const log = async (outcome: string, reason?: string) => {
      try { await admin.from("ai_usage_logs").insert({ user_id: u.user.id, model: "gemini-rotation", outcome, reason: reason?.slice(0, 200) ?? null }); } catch { /* never block */ }
    };
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ bypassed: true, reason: "not_configured" });

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
      generationConfig: { maxOutputTokens: 1024, responseMimeType: "application/json" },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    });
    // Free-tier daily quotas are per model (some only ~20/day), so rotate through every live model.
    // 404 (retired) and 429 (quota used) skip instantly; total time stays under the app's 30s wait.
    let r: Response | null = null;
    let sawQuota = false;
    const deadline = Date.now() + 25000;
    const today = new Date().toISOString().slice(0, 10);
    // Lite models have the largest free daily allowance, so try them first; skip models already used up today.
    for (const model of ["gemini-flash-lite-latest", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-3.5-flash"]) {
      if (exhausted.get(model) === today) { sawQuota = true; continue; }
      const left = deadline - Date.now();
      if (left < 3000) break;
      const ctrl = new AbortController();
      // Long wait: an abandoned request still uses up a free check.
      const timer = setTimeout(() => ctrl.abort(), Math.min(15000, left));
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: payload, signal: ctrl.signal });
        if (res.ok) { r = res; break; }
        if (res.status === 429) { sawQuota = true; exhausted.set(model, today); }
        if (res.status === 404) exhausted.set(model, today);
        console.error("gemini", model, res.status);
        await res.body?.cancel().catch(() => {});
      } catch (e) { console.error("gemini fetch", model, String(e)); } finally { clearTimeout(timer); }
    }
    if (!r && sawQuota) { await log("bypassed", "rate_limited"); return json({ bypassed: true, reason: "rate_limited" }); }
    if (!r) { await log("bypassed", "ai_unavailable"); return json({ bypassed: true, reason: "ai_unavailable" }); }
    const d = await r.json();
    const text = (d?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join(""); if (!text) console.error("empty", JSON.stringify(d).slice(0, 500));
    let v: any;
    try { v = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { await log("bypassed", "no_result"); return json({ bypassed: true, reason: "no_result" }); }
    const authentic = !!v.is_authentic && !v.is_ai_generated;
    const relevant = v.shows_issue === true && v.issue_category !== "none";
    await log(!authentic ? "flagged_fake" : !relevant ? "flagged_irrelevant" : "authentic", String(v.reason ?? ""));
    return json({
      is_authentic: !!v.is_authentic && !v.is_ai_generated,
      is_ai_generated: !!v.is_ai_generated,
      shows_waste: relevant,
      shows_issue: relevant,
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
