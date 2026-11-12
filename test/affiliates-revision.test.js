import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeAffiliateSlug, resolveAffiliateForCheckout,
  maybeCreateAffiliateCommission, finalizeAffiliateCommission,
} from '../server/affiliate.js';

function fakeDb(seed = {}) {
  const tables = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, structuredClone(rows)]));
  const queries = [];
  const db = { tables, queries, from(table) {
    tables[table] ||= [];
    const filters = [];
    let action = 'read'; let payload = null;
    let rangeLimit = null;
    const q = {
      select() { return q; },
      eq(k,v) { filters.push(row => row[k] === v); return q; },
      is(k,v) { filters.push(row => (row[k] ?? null) === v); return q; },
      gt(k,v) { filters.push(row => String(row[k]) > String(v)); return q; },
      in(k,arr) { filters.push(row => arr.includes(row[k])); return q; },
      order() { return q; },
      limit(n) { rangeLimit=n; return q; },
      update(v) { action = 'update'; payload = v; return q; },
      upsert(v) { action = 'upsert'; payload = v; return q; },
      insert(v) { action = 'insert'; payload=v; return q; },
      result() {
        const selected = tables[table].filter(row => filters.every(f => f(row)));
        queries.push({table,action,payload,selected: selected.length});
        if (action === 'update') selected.forEach(row => Object.assign(row,payload));
        if (action === 'upsert') {
          const existing = tables[table].find(row => row.order_id === payload.order_id);
          if (existing) Object.assign(existing,payload); else tables[table].push(payload);
          return { data: existing || payload, error:null };
        }
        if (action === 'insert') tables[table].push(payload);
        return { data: action === 'insert' ? payload : (rangeLimit === null ? selected : selected.slice(0,rangeLimit)), error:null };
      },
      async maybeSingle() { const response=q.result(); return {data: Array.isArray(response.data) ? response.data[0] || null : response.data,error:null}; },
      then(yes,no) { return Promise.resolve(q.result()).then(yes,no); },
    };
    return q;
  }};
  return db;
}
const sellerA = { id:'a',user_id:'user-a',slug:'ana',active:true,deleted_at:null,commission_type:'percent',commission_value:12 };
const sellerB = { id:'b',user_id:'user-b',slug:'bia',active:true,deleted_at:null,commission_type:'fixed',commission_value:25 };
const validVisit = { affiliate_id:'a',visitor_id:'visitor-12345678',expires_at:'2099-01-01T00:00:00.000Z',last_visit_at:'2026-11-12T12:00:00.000Z' };

test('slug de vendedor é normalizado', () => {
  assert.equal(normalizeAffiliateSlug('  JÚlia & Miniaturas ! '), 'julia-miniaturas');
});
test('não atribui comissão só por receber o slug no checkout (sem visita)', async () => {
  const sb=fakeDb({affiliates:[sellerA],affiliate_attributions:[],coupons:[]});
  const result=await resolveAffiliateForCheckout(sb,{affiliateSlug:'ana',visitorId:'visitor-12345678',userId:'customer'});
  assert.equal(result.affiliate,null);
});
test('atribui vendedor quando visita está registrada e dentro do prazo', async () => {
  const sb=fakeDb({affiliates:[sellerA],affiliate_attributions:[validVisit],coupons:[]});
  const result=await resolveAffiliateForCheckout(sb,{affiliateSlug:'ana',visitorId:validVisit.visitor_id,userId:'customer'});
  assert.equal(result.affiliate.id,'a'); assert.equal(result.source,'link');
});
test('atribuição expirada ou vendedor excluído não gera comissão', async () => {
  const sb=fakeDb({affiliates:[{...sellerA,deleted_at:'2026-11-11T00:00:00Z'}],affiliate_attributions:[validVisit]});
  assert.equal((await resolveAffiliateForCheckout(sb,{visitorId:validVisit.visitor_id,userId:'customer'})).affiliate,null);
  const sb2=fakeDb({affiliates:[sellerA],affiliate_attributions:[{...validVisit,expires_at:'2024-01-01'}]});
  assert.equal((await resolveAffiliateForCheckout(sb2,{visitorId:validVisit.visitor_id,userId:'customer'})).affiliate,null);
});
test('cupom de outro vendedor tem prioridade sobre indicação do link', async () => {
  const sb=fakeDb({affiliates:[sellerA,sellerB],affiliate_attributions:[validVisit],coupons:[{code:'BIA10',affiliate_id:'b',active:true}]});
  const result=await resolveAffiliateForCheckout(sb,{affiliateSlug:'ana',visitorId:validVisit.visitor_id,couponCode:'bia10',userId:'customer'});
  assert.equal(result.affiliate.id,'b'); assert.equal(result.source,'coupon');
});
test('vendedor não recebe comissão da própria compra', async () => {
  const sb=fakeDb({affiliates:[sellerA],affiliate_attributions:[validVisit]});
  assert.equal((await resolveAffiliateForCheckout(sb,{visitorId:validVisit.visitor_id,userId:'user-a'})).affiliate,null);
});
test('comissão é calculada antes do desconto e confirmada somente após pagamento', async () => {
  const sb=fakeDb({affiliates:[sellerA],affiliate_commissions:[]});
  const created=await maybeCreateAffiliateCommission(sb,{ order:{id:'order-1',order_type:'shop'},subtotal:200,affiliateId:'a',orderType:'shop' });
  assert.equal(created.commission_value,24); assert.equal(created.status,'pending');
  await finalizeAffiliateCommission(sb,'order-1',true);
  assert.equal(sb.tables.affiliate_commissions[0].status,'confirmed');
});
test('pagamentos já sacados não são rebaixados por webhook repetido', async () => {
  const sb=fakeDb({affiliate_commissions:[{order_id:'order-1',status:'paid',withdrawal_id:'withdrawal-1'}]});
  await finalizeAffiliateCommission(sb,'order-1',true);
  assert.equal(sb.tables.affiliate_commissions[0].status,'paid');
});
test('migração SQL fornece reserva atômica, privacidade e finalização de saques', () => {
  const sql=fs.readFileSync(new URL('../supabase/migrations/20261112_affiliates_withdrawals.sql',import.meta.url),'utf8');
  for(const fragment of ['FOR UPDATE','affiliate_request_withdrawal','affiliate_settle_withdrawal','ENABLE ROW LEVEL SECURITY','affiliate_dashboard_stats','GRANT EXECUTE']){
    assert.ok(sql.includes(fragment),fragment);
  }
});
