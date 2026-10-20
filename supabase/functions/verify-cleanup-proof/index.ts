import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PROMPT = `You compare two photos from a civic cleanup/repair task. Image 1 is BEFORE, image 2 is AFTER.
Judge: (a) do they show the same location (matching background, structures, angle roughly)? (b) how much of the issue in BEFORE is resolved in AFTER (0-100)? (c) does either look AI-generated or reused?
Reply ONLY with JSON: {"same_location": boolean, "cleanup_score": number 0-100, "suspicious": boolean, "summary": "one short sentence"}`;

async function fetchImage(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null;
    return { data: encodeBase64(buf), mime };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Sign in required" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => null);
    const taskId = body?.task_id;
    if (typeof taskId !== "string" || !/^[0-9a-f-]{36}$/i.test(taskId)) return json({ error: "Invalid task" }, 400);

    // RLS ensures only users allowed to view the task can read it
    const { data: task } = await sb.from("tasks").select("before_photo_url, after_photo_url").eq("id", taskId).maybeSingle();
    if (!task?.before_photo_url || !task?.after_photo_url) return json({ bypassed: true, reason: "missing_photos" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const log = async (outcome: string, reason?: string) => {
      try { await admin.from("ai_usage_logs").insert({ user_id: u.user.id, model: "gemini-3.5-flash", outcome, reason: `cleanup:${reason ?? ""}`.slice(0, 200) }); } catch { /* never block */ }
    };
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ bypassed: true, reason: "not_configured" });

    const [b, a] = await Promise.all([fetchImage(task.before_photo_url), fetchImage(task.after_photo_url)]);
    if (!b || !a) return json({ bypassed: true, reason: "image_unavailable" });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: PROMPT },
            { inline_data: { mime_type: b.mime, data: b.data } },
            { inline_data: { mime_type: a.mime, data: a.data } },
          ] }],
          generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" }, responseMimeType: "application/json" },
        }),
        signal: ctrl.signal,
      });
    } catch { await log("bypassed", "timeout"); return json({ bypassed: true, reason: "timeout" }); } finally { clearTimeout(timer); }
    if (r.status === 429) { await log("bypassed", "rate_limited"); return json({ bypassed: true, reason: "rate_limited" }); }
    if (!r.ok) { await log("bypassed", "ai_unavailable"); return json({ bypassed: true, reason: "ai_unavailable" }); }
    const d = await r.json();
    const text = (d?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
    let v: any;
    try { v = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { await log("bypassed", "no_result"); return json({ bypassed: true, reason: "no_result" }); }
    const score = Math.max(0, Math.min(100, Math.round(Number(v.cleanup_score) || 0)));
    await log(v.suspicious ? "flagged_fake" : "authentic", `score ${score}`);
    return json({
      same_location: !!v.same_location,
      cleanup_score: score,
      suspicious: !!v.suspicious,
      summary: String(v.summary ?? "").slice(0, 200),
    });
  } catch (e) {
    console.error(e);
    return json({ bypassed: true, reason: "server_error" });
  }
});
