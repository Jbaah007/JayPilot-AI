const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  if (!BACKEND_INTERNAL_URL) {
    return Response.json({ detail: "The API service is not configured." }, { status: 503 });
  }
  const incoming = new URL(request.url);
  const target = `${BACKEND_INTERNAL_URL.replace(/\/$/, "")}/${path
    .map((part) => encodeURIComponent(part))
    .join("/")}${incoming.search}`;
  const headers = new Headers();
  for (const name of ["accept", "authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json({ detail: "The API service is temporarily unavailable." }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
