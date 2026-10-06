// Función serverless de Vercel. Guarda los eventos en Upstash Redis (Vercel Marketplace).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

module.exports = async (req, res) => {
  try {
    if (!URL_ || !TOKEN) return res.status(500).json({ error: "Falta conectar la base de datos (Upstash Redis)." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (req.method === "GET") {
      const raw = await redis(["LRANGE", "events", 0, -1]);
      return res.status(200).json(raw.map((s) => JSON.parse(s)));
    }

    if (req.method === "POST") {
      const title = String(body.title || "").trim().slice(0, 80);
      const date = String(body.date || "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Datos inválidos" });
      const ev = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date,
        title,
        time: /^\d{2}:\d{2}$/.test(body.time || "") ? body.time : "",
        author: String(body.author || "").trim().slice(0, 30),
      };
      await redis(["RPUSH", "events", JSON.stringify(ev)]);
      return res.status(201).json(ev);
    }

    if (req.method === "DELETE") {
      const raw = await redis(["LRANGE", "events", 0, -1]);
      const hit = raw.find((s) => JSON.parse(s).id === body.id);
      if (hit) await redis(["LREM", "events", 1, hit]);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
