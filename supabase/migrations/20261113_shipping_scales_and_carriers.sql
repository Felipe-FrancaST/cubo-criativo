-- Execute após 20261113_superfrete.sql. Não altera cotações nem pedidos antigos.
-- Escalas usam modelos de caixa definidos no JSON packages. Cada escala pode apontar para uma caixa.
alter table public.shipping_settings
  add column if not exists scale_rules jsonb not null default '[
    {"id":"action_10cm","kind":"action","scale":"10 cm","package_key":"action_10"},
    {"id":"action_12cm","kind":"action","scale":"12 cm","package_key":"action_12"},
    {"id":"action_15cm","kind":"action","scale":"15 cm","package_key":"action_15"},
    {"id":"action_20cm","kind":"action","scale":"20 cm","package_key":"action_20"},
    {"id":"miniature_32mm","kind":"miniature","scale":"32 mm","small_package_key":"miniature_small","large_package_key":"miniature_large","small_limit":2,"large_limit":10}
  ]'::jsonb,
  add column if not exists package_labels jsonb not null default '{}'::jsonb;

-- Inclui Jadlog e Loggi somente se a loja ainda usa a seleção original dos Correios.
-- A cotação só exibirá serviços efetivamente habilitados/aceitos pela conta SuperFrete.
update public.shipping_settings
  set services = '1,2,3,17,31', updated_at = now()
  where id = 'default' and services = '1,2,17';
