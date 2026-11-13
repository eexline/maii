/**
 * Vercel → bot operator API proxy.
 * Set OPERATOR_BACKEND_URL=http://HOST:8080 (no trailing slash)
 */

function getBackend() {
  const raw = (process.env.OPERATOR_BACKEND_URL || "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("OPERATOR_BACKEND_URL is not set in Vercel env");
  return raw;
}

function joinPath(parts) {
  if (Array.isArray(parts)) return parts.map(encodeURIComponent).join("/");
  if (parts == null || parts === "") return "";
  return String(parts)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function forwardQuery(urlPath) {
  try {
    const u = new URL(urlPath, "http://local");
    u.searchParams.delete("path");
    const s = u.searchParams.toString();
    return s ? `?${s}` : "";
  } catch {
    return "";
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  let backend;
  try {
    backend = getBackend();
  } catch (err) {
    res.status(500).json({ detail: err.message });
    return;
  }

  const pathStr = joinPath(req.query.path);
  const target = `${backend}/api/${pathStr}${forwardQuery(req.url || "")}`;

  const headers = { accept: "application/json" };
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

  const text = await upstream.text();
  const ct = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  res.status(upstream.status).setHeader("content-type", ct).send(text);
};

module.exports.config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
    externalResolver: true,
  },
};
