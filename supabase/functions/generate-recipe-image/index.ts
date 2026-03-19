import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const { recipe_id, title_en, ingredients_en, category } = await req.json();

  const prompt = `Professional food photography of "${title_en}", a carnivore diet meal.
Ingredients: ${ingredients_en?.slice(0, 200)}.
Style: Close-up, mouthwatering, juicy, restaurant-quality plating on a dark slate or wooden board.
Dramatic lighting highlighting the texture of the meat. Ultra-realistic, 4K food photography.
No vegetables as main focus, no garnish that doesn't belong to carnivore diet.`;

  // Generate with DALL-E 3
  const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1024", quality: "standard" }),
  });

  const imgJson = await imgRes.json();
  if (!imgJson.data?.[0]?.url) {
    return new Response(JSON.stringify({ error: imgJson }), { status: 500 });
  }

  const imageUrl = imgJson.data[0].url;

  // Download the image
  const imgBlob = await fetch(imageUrl).then((r) => r.arrayBuffer());

  // Upload to Supabase Storage
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const storagePath = `recipes/${recipe_id}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("recipe-images")
    .upload(storagePath, imgBlob, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    return new Response(JSON.stringify({ error: uploadError }), { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // Update the recipe
  await supabase.from("recipes").update({ image_url: publicUrl }).eq("id", recipe_id);

  return new Response(JSON.stringify({ ok: true, url: publicUrl }), {
    headers: { "Content-Type": "application/json" },
  });
});
