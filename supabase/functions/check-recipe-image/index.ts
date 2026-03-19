const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;

Deno.serve(async (req) => {
  const { image_url, title_en, ingredients_en, category } = await req.json();

  // If URL is broken (relative path or old project), it doesn't match
  if (!image_url || image_url.startsWith("/") || image_url.includes("lglgmhzgxyvyftdhvdsy")) {
    return new Response(JSON.stringify({ matches: false, reason: "broken_url" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Try to fetch the image (with a controller-based timeout)
  let imageBase64: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const imgResp = await fetch(image_url, { signal: controller.signal });
    clearTimeout(timer);
    if (!imgResp.ok) {
      return new Response(JSON.stringify({ matches: false, reason: `fetch_${imgResp.status}` }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const buf = await imgResp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    imageBase64 = btoa(binary);
  } catch (err) {
    return new Response(JSON.stringify({ matches: false, reason: `fetch_error: ${err}` }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ask GPT-4o vision if the image matches the recipe
  const visionResp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `This image is supposed to show a carnivore diet dish called "${title_en}" (category: ${category}). Key ingredients: ${(ingredients_en || "").slice(0, 200)}.

Does this image clearly show this specific dish or something very similar? Answer ONLY with YES or NO.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  const visionJson = await visionResp.json();
  const answer = visionJson.choices?.[0]?.message?.content?.trim().toUpperCase() ?? "NO";
  const matches = answer.startsWith("YES");

  return new Response(JSON.stringify({ matches, answer }), {
    headers: { "Content-Type": "application/json" },
  });
});
