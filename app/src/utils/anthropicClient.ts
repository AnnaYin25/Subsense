/**
 * Anthropic client wrapper.
 *
 * Drop-in replacement for `new Anthropic({ apiKey })` that routes all calls
 * through the Supabase Edge Function `claude-proxy` instead of hitting the
 * Anthropic API directly. The API key never ships in the client bundle.
 *
 * Why: `EXPO_PUBLIC_*` env vars are bundled into the React Native binary,
 * so anyone with the app can extract the key. The proxy holds the key
 * server-side and validates requests via Supabase JWT auth.
 *
 * Interface mirrors the subset of `@anthropic-ai/sdk` we actually use:
 *   anthropic.messages.create({ model, max_tokens, system, messages })
 */

import { supabase } from './supabase';

// Supabase anon key — public by design, used here to bypass any stale/expired
// session token that supabase-js would otherwise attach to function calls.
// The Edge Function gateway requires SOME valid JWT; the anon key always is one.
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// ---- Request types (subset of Anthropic's MessageCreateParams) ----

export interface CacheControl {
  type: 'ephemeral';
}

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

export interface MessageParam {
  role: 'user' | 'assistant';
  content: string;
}

export interface MessageCreateParams {
  model: string;
  max_tokens: number;
  system?: string | SystemBlock[];
  messages: MessageParam[];
  temperature?: number;
}

// ---- Response types (subset we read in callers) ----

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface MessageResponse {
  id?: string;
  type?: 'message';
  role?: 'assistant';
  model?: string;
  content: TextContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

// ---- Implementation ----

async function createMessage(params: MessageCreateParams): Promise<MessageResponse> {
  const { data, error } = await supabase.functions.invoke('claude-proxy', {
    body: params,
    headers: {
      // Force the anon key — overriding any expired session JWT that
      // supabase-js might otherwise attach automatically.
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (error) {
    // FunctionsHttpError exposes the underlying Response on `error.context`.
    // Read its body so we can log the actual reason (model not found, auth
    // failure, anthropic error, etc.) instead of the opaque "non-2xx" string.
    let detail = '';
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        detail = await ctx.text();
      } catch {
        detail = `<failed to read body, status=${ctx.status}>`;
      }
    } else if (typeof ctx === 'string') {
      detail = ctx;
    }
    const fullMessage = `claude-proxy invoke failed: ${error.message}${detail ? ` — ${detail}` : ''}`;
    console.error('[anthropicClient]', fullMessage);
    throw new Error(fullMessage);
  }

  if (!data) {
    throw new Error('claude-proxy returned empty response');
  }

  // Anthropic returns {type: "error", error: {...}} on API errors with 4xx
  // status. The proxy passes the body through, so check for that shape too.
  const maybeError = data as { type?: string; error?: { message?: string; type?: string } };
  if (maybeError.type === 'error') {
    throw new Error(
      `Anthropic error: ${maybeError.error?.type ?? 'unknown'} — ${maybeError.error?.message ?? 'no message'}`,
    );
  }

  return data as MessageResponse;
}

export const anthropic = {
  messages: {
    create: createMessage,
  },
};
