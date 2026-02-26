/**
 * Admin: resultados da votação VIP (tema do próximo mês)
 * Route: /api/admin/vip-voting
 *
 * Requer admin (ADMIN_EMAILS + Bearer token)
 */

import { supabaseAdmin } from "../../server/supabase.js";
import { requireAdmin } from "../../server/admin/adminAuth.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const sb = supabaseAdmin();

    const monthKey = String(req.query?.month_key || "").trim();
    const limit = Math.min(12, Math.max(1, Number(req.query?.limit || 6) || 6));

    let pollsQuery = sb
      .from("vip_theme_polls")
      .select("id,month_key,title,status,created_at,updated_at")
      .order("month_key", { ascending: false })
      .limit(limit);

    if (monthKey) pollsQuery = pollsQuery.eq("month_key", monthKey);

    const { data: polls, error: pollsErr } = await pollsQuery;
    if (pollsErr) return res.status(500).json({ error: pollsErr.message || "Failed to load polls" });

    const pollList = Array.isArray(polls) ? polls : [];
    if (!pollList.length) return res.status(200).json({ polls: [] });

    const pollIds = pollList.map((p) => p.id);

    const [{ data: options, error: optErr }, { data: votes, error: voteErr }] = await Promise.all([
      sb
        .from("vip_theme_options")
        .select("id,poll_id,title,description,image_url,sort_order,active,created_at")
        .in("poll_id", pollIds)
        .order("sort_order", { ascending: true }),
      sb
        .from("vip_theme_votes")
        .select("poll_id,option_id")
        .in("poll_id", pollIds),
    ]);

    if (optErr) return res.status(500).json({ error: optErr.message || "Failed to load options" });
    if (voteErr) return res.status(500).json({ error: voteErr.message || "Failed to load votes" });

    const counts = new Map();
    (votes || []).forEach((v) => {
      const k = `${v.poll_id}:${v.option_id}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    });

    const optionsByPoll = new Map();
    (options || []).forEach((o) => {
      const pid = String(o.poll_id);
      if (!optionsByPoll.has(pid)) optionsByPoll.set(pid, []);
      optionsByPoll.get(pid).push({
        ...o,
        votes: counts.get(`${o.poll_id}:${o.id}`) || 0,
      });
    });

    const result = pollList.map((p) => {
      const opts = optionsByPoll.get(String(p.id)) || [];
      const totalVotes = opts.reduce((acc, it) => acc + (Number(it.votes) || 0), 0);
      return {
        poll: p,
        total_votes: totalVotes,
        options: opts.map((o) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          image_url: o.image_url,
          sort_order: o.sort_order,
          active: o.active,
          votes: o.votes,
          pct: totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0,
        })),
      };
    });

    return res.status(200).json({ polls: result });
  } catch (e) {
    console.error("admin/vip-voting error", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
