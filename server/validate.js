import { z } from "zod";

export function safeJsonBody(req) {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function validateBody(schema, body) {
  try {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid payload",
        details: parsed.error.issues?.map((i) => ({ path: i.path.join("."), message: i.message })) || [],
      };
    }
    return { ok: true, data: parsed.data };
  } catch (e) {
    return { ok: false, status: 400, error: "Invalid payload", details: [{ message: e?.message || String(e) }] };
  }
}

export { z };
