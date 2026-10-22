/**
 * Anthropic client wrapper for web.
 * Routes all calls through Next.js API route /api/claude so the API key
 * never ships to the browser.
 */

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

async function createMessage(params: MessageCreateParams): Promise<MessageResponse> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`claude api route failed: ${res.status}${detail ? ` — ${detail}` : ''}`);
  }

  const data: MessageResponse = await res.json();

  const maybeError = data as { type?: string; error?: { message?: string; type?: string } };
  if (maybeError.type === 'error') {
    throw new Error(
      `Anthropic error: ${maybeError.error?.type ?? 'unknown'} — ${maybeError.error?.message ?? 'no message'}`,
    );
  }

  return data;
}

export const anthropic = {
  messages: {
    create: createMessage,
  },
};
