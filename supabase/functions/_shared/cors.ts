// 5173 = Vite dev (`npm run dev`)、4173 = 配布 exe / preview (`overlay-local-server.mjs`)
const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

/** Comma-separated in OVERLAY_ORIGIN, e.g. `https://app.example.com,http://localhost:4173` */
export function configuredOrigins(): string[] {
  const raw = Deno.env.get('OVERLAY_ORIGIN') ?? 'http://localhost:5173'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function allowedOrigins(): string[] {
  return [...new Set([...configuredOrigins(), ...LOCAL_DEV_ORIGINS])]
}

/** Primary origin (OAuth リダイレクト等) */
export function overlayOrigin(): string {
  return configuredOrigins()[0] ?? 'http://localhost:5173'
}

export function resolveCorsOrigin(req: Request): string {
  const origin = req.headers.get('Origin')?.trim()
  if (origin && allowedOrigins().includes(origin)) return origin
  return overlayOrigin()
}

export function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(req),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) })
  }
  return null
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(req),
      ...extraHeaders,
    },
  })
}
