/**
 * Vercel proxy → operator API on the bot server.
 * Env: OPERATOR_BACKEND_URL=http://2.27.120.71:8643
 */

function backend() {
  const raw = (process.env.OPERATOR_BACKEND_URL || "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("OPERATOR_BACKEND_URL is not set");
  return raw;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  let base;
  try {
    base = backend();
  } catch (err) {
    res.status(500).json({ detail: err.message });
    return;
  }

  // /api/proxy?path=login  OR  /api/proxy?path=leads/1/messages&after_id=0
  const pathParam = req.query.path;
  const pathStr = Array.isArray(pathParam)
    ? pathParam.filter(Boolean).join("/")
    : String(pathParam || "").replace(/^\/+/, "");

  if (!pathStr) {
    res.status(400).json({ detail: "Missing path" });
    return;
  }

  const forward = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach((x) => forward.append(k, String(x)));
    else if (v != null) forward.append(k, String(v));
  }
  const qs = forward.toString();
  const target = `${base}/api/${pathStr}${qs ? `?${qs}` : ""}`;

  const headers = { accept: "*/*" };
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (typeof req.body === "string") body = req.body;
    else if (Buffer.isBuffer(req.body)) body = req.body;
    else if (req.body != null) body = JSON.stringify(req.body);
  }

  let upstream;
  try {
    upstream = await fetch(target, { method: req.method, headers, body });
  } catch (err) {
    res.status(502).json({ detail: `Backend unreachable: ${err.message || err}` });
    return;
  }

  const ct = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  const cache = upstream.headers.get("cache-control");
  if (cache) res.setHeader("Cache-Control", cache);
  res.status(upstream.status).setHeader("content-type", ct);

  // Binary (avatars) — don't force UTF-8 text
  if (/^image\//i.test(ct) || /octet-stream/i.test(ct)) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
    return;
  }

  const text = await upstream.text();
  res.send(text);
};

module.exports.config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
    externalResolver: true,
  },
};
