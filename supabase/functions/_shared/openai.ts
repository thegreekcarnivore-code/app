const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

export class OpenAIRequestError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, message = "OpenAI request failed") {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = status;
    this.body = body;
  }
}

function getOpenAIApiKey() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return apiKey;
}

export function getOpenAIModel(envName: string, fallback: string) {
  return Deno.env.get(envName) || fallback;
}

async function parseOpenAIResponse(response: Response) {
  if (response.ok) {
    return await response.json();
  }

  const body = await response.text();
  throw new OpenAIRequestError(response.status, body);
}

export async function createOpenAIChatCompletion(body: Record<string, unknown>) {
  const response = await createOpenAIChatCompletionResponse(body);
  return await parseOpenAIResponse(response);
}

export async function createOpenAIChatCompletionResponse(body: Record<string, unknown>) {
  return await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function createOpenAIEmbeddings(
  inputs: string[],
  model: string = getOpenAIModel("OPENAI_MODEL_EMBEDDING", "text-embedding-3-small"),
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const response = await fetch(`${OPENAI_API_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: inputs }),
  });
  const data = await parseOpenAIResponse(response);
  if (!Array.isArray(data?.data)) throw new Error("Invalid embeddings response");
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((row: { embedding: number[] }) => row.embedding);
}

export async function transcribeAudioWithOpenAI({
  audioBytes,
  fileName,
  mimeType,
  prompt,
  language,
  model = getOpenAIModel("OPENAI_MODEL_TRANSCRIPTION", "gpt-4o-mini-transcribe"),
}: {
  audioBytes: Uint8Array;
  fileName: string;
  mimeType: string;
  prompt?: string;
  language?: string;
  model?: string;
}) {
  const form = new FormData();
  form.append("file", new Blob([audioBytes], { type: mimeType }), fileName);
  form.append("model", model);
  if (prompt) form.append("prompt", prompt);
  if (language) form.append("language", language);

  const response = await fetch(`${OPENAI_API_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
    },
    body: form,
  });

  const data = await parseOpenAIResponse(response);
  return typeof data.text === "string" ? data.text.trim() : "";
}

export function buildOpenAIErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string>,
  {
    defaultMessage = "AI request failed",
    rateLimitMessage = "Rate limit exceeded. Please try again later.",
  }: {
    defaultMessage?: string;
    rateLimitMessage?: string;
  } = {},
) {
  if (!(error instanceof OpenAIRequestError)) return null;

  const status = error.status === 429 ? 429 : 500;
  const message = error.status === 429 ? rateLimitMessage : defaultMessage;

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
