// Supabase Edge Function: claude-proxy
//
// Forwards Anthropic API requests from the client app, holding the API key
// server-side so it never ships in the React Native bundle. Supports prompt
// caching, multi-block system prompts, and any other Anthropic /v1/messages
// parameters by passing the request body through transparently.
//
// Auth: Uses Supabase JWT verification (default). Only logged-in users can
// reach this function — `supabase.functions.invoke('claude-proxy', ...)` from
// the client automatically attaches the user's JWT.
//
// Deploy:
//   supabase functions deploy claude-proxy
//   supabase secrets set ANTHROPIC_API_KEY=<your-anthropic-api-key>

// deno-lint-ignore-file no-explicit-any

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Prompt caching is GA but the SDK still sends it as a beta header on some
// versions — include it to be safe across SDK versions.
const ANTHROPIC_BETA = "prompt-caching-2024-07-31";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on server" }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  // Basic validation — anything more strict belongs in the client.
  if (!body || typeof body !== "object" || !body.model || !body.messages) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: model, messages" }),
      { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-beta": ANTHROPIC_BETA,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseBody = await upstream.text();

    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: `Upstream request failed: ${message}` }),
      { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
});
