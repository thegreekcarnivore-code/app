import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenAIChatCompletionResponse, getOpenAIModel } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Authorization model:
// - Bearer SUPABASE_SERVICE_ROLE_KEY (Supabase cron) -> allowed
// - Authorization header from an admin user -> allowed
// - Anything else -> 401
async function authorize(req: Request): Promise<{ adminUserId: string | null }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (token && serviceRoleKey && token === serviceRoleKey) return { adminUserId: null };

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("UNAUTHORIZED");
  const userId = data.claims.sub as string;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("FORBIDDEN");
  return { adminUserId: userId };
}

interface PromptTemplate {
  id: string;
  dow: number;
  language: string;
  title: string;
  body: string;
  tag: string | null;
}

async function moderateRecentPosts(admin: ReturnType<typeof createClient>) {
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const { data: posts, error } = await admin
    .from("group_posts")
    .select("id, content, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error || !posts || posts.length === 0) return { checked: 0, flagged: 0 };

  const { data: alreadyChecked } = await admin
    .from("community_post_moderation")
    .select("group_post_id")
    .in("group_post_id", posts.map((p: { id: string }) => p.id));
  const checkedIds = new Set((alreadyChecked ?? []).map((r: { group_post_id: string }) => r.group_post_id));
  const toCheck = posts.filter((p: { id: string; content: string }) => !checkedIds.has(p.id) && (p.content?.length ?? 0) > 4);

  if (toCheck.length === 0) return { checked: 0, flagged: 0 };

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { checked: 0, flagged: 0 };

  let flagged = 0;
  for (const post of toCheck) {
    try {
      const res = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "omni-moderation-latest", input: post.content }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.results?.[0];
      if (!result) continue;
      const isFlagged = Boolean(result.flagged);
      await admin.from("community_post_moderation").upsert(
        {
          group_post_id: post.id,
          flagged: isFlagged,
          categories: result.categories ?? {},
          category_scores: result.category_scores ?? {},
          detector_model: "omni-moderation-latest",
        },
        { onConflict: "group_post_id" },
      );
      if (isFlagged) flagged += 1;
    } catch (e) {
      console.error("moderation failed for post", post.id, e);
    }
  }
  return { checked: toCheck.length, flagged };
}

async function rephraseWithAlexVoice(title: string, body: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return `${title}\n\n${body}`;
  try {
    const res = await createOpenAIChatCompletionResponse({
      model: getOpenAIModel("OPENAI_MODEL_COMMUNITY_PROMPT", "gpt-4.1-mini"),
      messages: [
        {
          role: "system",
          content:
            "You are Alex (Αλέξανδρος Αδαμαντιάδης). Rewrite the given community prompt in your voice for the Greek Carnivore Único community. Keep it short (2-4 sentences), Greek if input is Greek, direct, no emojis, no clichés, one CTA at most. Honor double accents and noun-gender agreement.",
        },
        { role: "user", content: `${title}\n\n${body}` },
      ],
    });
    if (!res.ok) return `${title}\n\n${body}`;
    const json = await res.json();
    const out = json?.choices?.[0]?.message?.content?.trim();
    return typeof out === "string" && out.length > 10 ? out : `${title}\n\n${body}`;
  } catch (e) {
    console.error("rephrase failed:", e);
    return `${title}\n\n${body}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await authorize(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message === "FORBIDDEN" ? 403 : 401;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Look up which groups to post into. Empty config = dormant cron (safe default).
    const { data: groupConfigRow } = await admin
      .from("app_config")
      .select("value")
      .eq("key", "unico_community_group_ids")
      .maybeSingle();
    const targetGroupIds: string[] = Array.isArray(groupConfigRow?.value) ? (groupConfigRow!.value as string[]) : [];

    // Resolve admin posting identity
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", "info@thegreekcarnivore.com")
      .maybeSingle();
    if (!adminProfile?.id) throw new Error("Admin profile not found");

    const today = new Date();
    const isoDate = today.toISOString().slice(0, 10);
    const dow = today.getUTCDay();

    // Pick today's prompt
    const { data: templates, error: tplErr } = await admin
      .from("community_prompt_templates")
      .select("id, dow, language, title, body, tag, last_used_at")
      .eq("dow", dow)
      .eq("is_active", true)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1);
    if (tplErr) throw tplErr;
    const template = (templates ?? [])[0] as PromptTemplate | undefined;

    const moderation = await moderateRecentPosts(admin);

    if (!template) {
      return new Response(
        JSON.stringify({ ok: true, posted: 0, moderation, note: "no prompt template for this dow" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (targetGroupIds.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          posted: 0,
          moderation,
          note: "unico_community_group_ids not configured — cron is dormant. Set app_config.unico_community_group_ids to enable.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const content = await rephraseWithAlexVoice(template.title, template.body);

    let posted = 0;
    for (const groupId of targetGroupIds) {
      const { data: existing } = await admin
        .from("community_auto_posts")
        .select("id")
        .eq("prompt_template_id", template.id)
        .eq("posted_for_date", isoDate)
        .eq("group_id", groupId)
        .maybeSingle();
      if (existing) continue;

      const { data: post, error: postErr } = await admin
        .from("group_posts")
        .insert({ group_id: groupId, user_id: adminProfile.id, content })
        .select("id")
        .single();
      if (postErr || !post) {
        console.error("group_posts insert failed:", postErr);
        continue;
      }

      await admin.from("community_auto_posts").insert({
        group_id: groupId,
        prompt_template_id: template.id,
        group_post_id: post.id,
        posted_for_date: isoDate,
      });
      posted += 1;
    }

    if (posted > 0) {
      await admin
        .from("community_prompt_templates")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", template.id);
    }

    return new Response(
      JSON.stringify({ ok: true, posted, prompt: template.tag, moderation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("community-auto-prompt error:", e);
    const message = e instanceof Error ? e.message : "community auto prompt failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
