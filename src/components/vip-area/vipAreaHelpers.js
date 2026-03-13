export function cycleKeyUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function cycleDeadlineLabel(cycleKey) {
  try {
    const [year, month] = String(cycleKey || '').split('-').map(Number);
    if (!year || !month) return 'fim do mês';
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    return end.toLocaleDateString('pt-BR');
  } catch {
    return 'fim do mês';
  }
}

export function vipBlockMessage(status) {
  const v = String(status || '').toLowerCase();
  if (v === 'em_producao') return { title: 'Aguardando produção', text: 'Suas escolhas deste ciclo já foram fechadas e estão em processo de produção.' };
  if (v === 'enviado') return { title: 'Pedido enviado', text: 'Seu pedido deste ciclo já foi enviado. As escolhas ficam bloqueadas até a abertura do próximo ciclo.' };
  if (v === 'entregue') return { title: 'Ciclo encerrado', text: 'Este ciclo já foi concluído. Aguarde a abertura do próximo para fazer novas escolhas.' };
  return null;
}

export function statusLabel(s) {
  const v = String(s || "editavel").toLowerCase();
  if (v === "editavel" || v === "recebido") return { label: "Editável", cls: "bg-emerald-500/10 ring-emerald-400/25 text-emerald-200" };
  if (v === "em_producao") return { label: "Em produção", cls: "bg-cyan-600/10 ring-indigo-400/25 text-indigo-200" };
  if (v === "enviado") return { label: "Enviado", cls: "bg-cyan-500/10 ring-amber-400/25 text-cyan-200" };
  if (v === "entregue") return { label: "Entregue", cls: "bg-teal-500/10 ring-teal-400/25 text-teal-200" };
  return { label: v.replaceAll("_", " "), cls: "bg-white/4 ring-white/15 text-slate-200" };
}

export function fmtBRLFromCents(cents) {
  const n = Number(cents);
  if (!isFinite(n)) return '—';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function tabHelpContent(tab, ctx = {}) {
  const total = Number(ctx?.totalLimit || 0) || 0;
  const editable = !!ctx?.editable;
  const planName = ctx?.planName || 'VIP';
  const deadline = ctx?.deadline || 'fim do mês';

  const map = {
    escolhas: {
      title: 'Como funciona — Escolhas',
      body: `Selecione exatamente ${total} item(ns) do seu plano ${planName}. Quando completar o limite, o botão para salvar aparece. Você pode alterar tudo enquanto o ciclo estiver editável. Prazo atual: ${deadline}.`,
    },
    pedido: {
      title: 'Como funciona — Pedido',
      body: editable
        ? 'Aqui você acompanha o status do seu ciclo VIP. Enquanto o pedido estiver editável, ainda dá para revisar escolhas. Quando avançar para produção ou envio, esta aba vira o painel de acompanhamento.'
        : 'Aqui você acompanha o status do seu ciclo VIP, produção e envio. Quando houver rastreio disponível, ele aparece nesta aba para consulta e cópia.',
    },
    votacao: {
      title: 'Como funciona — Votação',
      body: 'Nesta aba você vota no tema futuro do clube. Cada assinante VIP pode registrar um voto por ciclo aberto. Quando a votação encerrar, o resultado fica consolidado pelo sistema.',
    },
    upgrade: {
      title: 'Como funciona — Upgrade',
      body: 'Se quiser subir de nível, faça o upgrade aqui. O sistema mostra o próximo plano disponível e libera mais benefícios conforme a regra do clube.',
    },
    presente: {
      title: 'Como funciona — Presente',
      body: 'Você tem uma rolagem do d20 por ciclo mensal. O número define automaticamente o prêmio do mês. Se cair cupom, ele é salvo na sua conta. Se cair 20, você libera a miniatura personalizada exclusiva e pode solicitar o prêmio aqui mesmo.',
    },
  };
  return map[tab] || map.escolhas;
}

export function normalizeText(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function findPlanByProfileValue(plans, profilePlan) {
  const q = normalizeText(profilePlan);
  if (!q) return null;
  return (plans || []).find((p) => {
    const candidates = [p?.id, p?.slug, p?.name, p?.short_name, p?.title].map(normalizeText);
    return candidates.some((c) => c && (c === q || q.includes(c) || c.includes(q)));
  }) || null;
}

export function readVipCache(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeVipCache(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function clearVipCache(key) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}
