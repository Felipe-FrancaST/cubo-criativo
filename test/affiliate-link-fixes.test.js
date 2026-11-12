import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { claimAffiliateReferral, getAffiliateWelcomeCoupon, resolveAffiliateForCheckout, trackAffiliateVisit } from '../server/affiliate.js';

const affiliate = { id:'seller-1',user_id:'seller-user',slug:'parceira-rpg',active:true,deleted_at:null,commission_type:'percent',commission_value:10,attribution_days:30 };
const sharedCoupon = { code:'PARCEIRA10',affiliate_id:'seller-1',active:true,discount_type:'percent',discount_value:10,used_count:0,max_uses:100,created_at:new Date().toISOString() };

function db(seed) {
  const tables = structuredClone(seed);
  const calls=[];
  return { tables, calls, from(name) {
    const table=tables[name] ||= [];
    const filters=[];
    let action='read', payload=null, options={}, max=Infinity, descending=null;
    const query={
      select(){return query},
      eq(k,v){filters.push(row=>row[k]===v);return query},
      gt(k,v){filters.push(row=>String(row[k])>String(v));return query},
      is(k,v){filters.push(row=>(row[k]??null)===v);return query},
      order(k, {ascending=true}={}) { descending=ascending?null:k;return query },
      limit(n) {max=n;return query},
      insert(obj){action='insert';payload=obj;return query},
      update(obj){action='update';payload=obj;return query},
      upsert(obj, opts={}){action='upsert';payload=obj;options=opts;return query},
      result() {
        const found=table.filter(row=>filters.every(f=>f(row)));
        if(descending)found.sort((a,b)=>String(b[descending]??'').localeCompare(String(a[descending]??'')));
        calls.push({name,action,payload});
        if(action==='insert') { table.push({...payload,id:payload.id||`inserted-${table.length+1}`}); return {data:null,error:null} }
        if(action==='update') {for(const row of found)Object.assign(row,payload); return {data:null,error:null} }
        if(action==='upsert') {const keys=String(options.onConflict||'id').split(',');const existing=table.find(row=>keys.every(k=>row[k]===payload[k]));if(existing){if(!options.ignoreDuplicates)Object.assign(existing,payload)}else table.push({...payload});return {data:null,error:null}}
        return {data:found.slice(0,max),error:null};
      },
      async maybeSingle(){const res=query.result();return {...res,data:Array.isArray(res.data)?(res.data[0]||null):res.data}},
      then(resolve,reject){return Promise.resolve(query.result()).then(resolve,reject)}
    };
    return query;
  }};
}

test('visita pelo link retorna um cupom ativo e registra visitante no servidor', async()=>{
  const sb=db({affiliates:[affiliate],coupons:[sharedCoupon],affiliate_visits:[],affiliate_attributions:[]});
  const result=await trackAffiliateVisit(sb,{slug:'parceira-rpg',visitorId:'visitor-123456789',landingPage:'/v/parceira-rpg'});
  assert.equal(result.ok,true);
  assert.equal(result.coupon.code,'PARCEIRA10');
  assert.equal(sb.tables.affiliate_visits.length,1);
  assert.equal(sb.tables.affiliate_attributions[0].visitor_id,'visitor-123456789');
});

test('usuário que entra depois do link recebe cupom e atribuição de comissões por conta',async()=>{
  const sb=db({affiliates:[affiliate],coupons:[sharedCoupon],affiliate_visits:[],affiliate_attributions:[],affiliate_user_attributions:[],affiliate_coupon_claims:[]});
  await trackAffiliateVisit(sb,{slug:affiliate.slug,visitorId:'visitor-123456789'});
  const claimed=await claimAffiliateReferral(sb,{slug:affiliate.slug,visitorId:'visitor-123456789',userId:'buyer-1'});
  assert.equal(claimed.coupon.code,'PARCEIRA10');
  assert.equal(sb.tables.affiliate_coupon_claims[0].user_id,'buyer-1');
  assert.equal(sb.tables.affiliate_user_attributions[0].affiliate_id,affiliate.id);
  const resolved=await resolveAffiliateForCheckout(sb,{userId:'buyer-1',visitorId:'another-device-12345',couponCode:null});
  assert.equal(resolved.affiliate.id,affiliate.id);
  assert.equal(resolved.source,'link');
  assert.equal(resolved.visitorId,'visitor-123456789');
  await claimAffiliateReferral(sb,{slug:affiliate.slug,visitorId:'visitor-123456789',userId:'buyer-1'});
  assert.equal(sb.tables.affiliate_coupon_claims.length,1,'resgate deve ser idempotente');
});

test('não aceita link inventado nem permite vendedor usar sua própria indicação',async()=>{
  const sb=db({affiliates:[affiliate],coupons:[sharedCoupon],affiliate_attributions:[],affiliate_user_attributions:[],affiliate_coupon_claims:[]});
  const bad=await claimAffiliateReferral(sb,{slug:affiliate.slug,visitorId:'forged-visitor-1234',userId:'buyer-1'});
  assert.equal(bad.ok,false);
  assert.equal(sb.tables.affiliate_coupon_claims.length,0);
  const own=await claimAffiliateReferral(sb,{slug:affiliate.slug,visitorId:'forged-visitor-1234',userId:'seller-user'});
  assert.equal(own.status,403);
});

test('não distribui cupom vencido nem esgotado',async()=>{
  const sb=db({coupons:[{...sharedCoupon,max_uses:1,used_count:1},{...sharedCoupon,code:'EXPIRED',expires_at:'2000-01-01T00:00:00Z'}]});
  assert.equal(await getAffiliateWelcomeCoupon(sb,affiliate.id),null);
});

test('Pix envia o contexto de vendedor, saque exige senha no servidor e confirmação usa modal',()=>{
  const cart=fs.readFileSync(new URL('../src/components/CartDrawer.jsx',import.meta.url),'utf8');
  const api=fs.readFileSync(new URL('../api/affiliate.js',import.meta.url),'utf8');
  const seller=fs.readFileSync(new URL('../src/pages/SellerDashboardPage.jsx',import.meta.url),'utf8');
  const admin=fs.readFileSync(new URL('../src/pages/admin/affiliates/AdminAffiliatesSection.jsx',import.meta.url),'utf8');
  const coupons=fs.readFileSync(new URL('../server/api_handlers/coupons.js',import.meta.url),'utf8');
  assert.match(cart,/\.\.\.getAffiliateCheckoutContext\(\)/);
  assert.match(cart,/autoOpenCoupons/);
  assert.match(api,/verifyAccountPassword\(context\.user, password\)/);
  assert.match(seller,/type="password"/);
  assert.match(seller,/Copiar cupom/);
  assert.match(admin,/Confirmar saque executado/);
  assert.doesNotMatch(seller,/window\.confirm/);
  assert.doesNotMatch(admin,/window\.confirm\(`\$\{verb\}/);
  assert.match(coupons,/affiliate_coupon_claims/);
  const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/Faça login ou crie sua conta para garantir o seu cupom/);
  assert.match(app,/claim-referral/);
});

test('migração protege os resgates e vínculos pessoais com RLS',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20261112_affiliate_link_coupons_and_secure_withdrawal.sql',import.meta.url),'utf8');
  for(const str of ['affiliate_user_attributions','affiliate_coupon_claims','ENABLE ROW LEVEL SECURITY','REVOKE ALL','service_role'])assert.ok(sql.includes(str),str);
});
