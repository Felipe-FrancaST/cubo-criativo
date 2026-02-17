-- ==============================
-- Cubo Criativo — Seed inicial de produtos
-- Cole no Supabase -> SQL Editor -> RUN
-- (Pode rodar várias vezes: usa UPSERT)
-- ==============================

insert into public.products (id, name, image_url, images, model_url, status, featured, tags, default_variant, variants)
values
  (
    'p1',
    'Minthara (Baldur''s Gate)',
    '/images/prod1.jpg',
    '["/images/prod1.jpg"]'::jsonb,
    '/models/mintharaviewer.glb',
    'estoque',
    true,
    array['Baldur''s Gate','Games','RPG'],
    '1/7 - 24 cm',
    '[{"label":"1/7 - 24 cm","price":500}]'::jsonb
  ),
  (
    'p2',
    'Majin Boo',
    '/images/prod2.jpg',
    '["/images/prod2.jpg","/images/prod2-1.jpg"]'::jsonb,
    null,
    'catalogo',
    true,
    array['DBZ','Animes'],
    '1/8 - 30 cm',
    '[{"label":"1/8 - 30 cm","price":1}]'::jsonb
  ),
  (
    'p3',
    'Konan',
    '/images/prod3.jpg',
    '["/images/prod3.jpg","/images/prod3-1.jpg"]'::jsonb,
    null,
    'catalogo',
    true,
    array['Naruto','Animes'],
    '1/9 - 26 cm',
    '[{"label":"1/9 - 26 cm","price":500}]'::jsonb
  ),
  (
    'p4',
    'Arlequina (NFSW)',
    '/images/prod4.jpg',
    '["/images/prod4.jpg","/images/prod4-1.jpg","/images/prod4-2.jpg"]'::jsonb,
    null,
    'catalogo',
    false,
    array['DC','Filmes','HQs','NFSW'],
    '1/6 - 33 cm',
    '[{"label":"1/6 - 33 cm","price":420}]'::jsonb
  ),
  (
    'p5',
    'Naruto (Clássico)',
    '/images/prod5.jpg',
    '["/images/prod5.jpg","/images/prod5-1.jpg"]'::jsonb,
    null,
    'catalogo',
    false,
    array['Naruto','Animes'],
    '1/6 - 27 cm',
    '[{"label":"1/6 - 27 cm","price":490}]'::jsonb
  ),
  (
    'p6',
    'Naruto (Hokage)',
    '/images/prod6.jpg',
    '["/images/prod6.jpg"]'::jsonb,
    null,
    'catalogo',
    false,
    array['Naruto','Animes'],
    '1/9 - 22 cm',
    '[{"label":"1/9 - 22 cm","price":425}]'::jsonb
  ),
  (
    'p7',
    'Jinbe',
    '/images/prod7.jpg',
    '["/images/prod7.jpg","/images/prod7-1.jpg","/images/prod7-2.jpg"]'::jsonb,
    null,
    'catalogo',
    false,
    array['One Piece','Animes'],
    '1/20 - 15 cm',
    '[{"label":"1/20 - 15 cm","price":400}]'::jsonb
  ),
  (
    'p8',
    'Zoe',
    '/images/prod8.jpg',
    '["/images/prod8.jpg","/images/prod8-1.jpg","/images/prod8-2.jpg"]'::jsonb,
    null,
    'catalogo',
    false,
    array['League of Legends','Jogos'],
    '1/13 - 12 cm',
    '[{"label":"1/13 - 12 cm","price":220}]'::jsonb
  ),
  (
    'p9',
    'Sung Jin Woo',
    '/images/prod57.jpg',
    '["/images/prod57.jpg","/images/prod57-1.jpg","/images/prod57-2.jpg"]'::jsonb,
    null,
    'catalogo',
    false,
    array['Solo Leveling','Animes'],
    '1/13 - 12 cm',
    '[{"label":"1/13 - 12 cm","price":220}]'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  images = excluded.images,
  model_url = excluded.model_url,
  status = excluded.status,
  featured = excluded.featured,
  tags = excluded.tags,
  default_variant = excluded.default_variant,
  variants = excluded.variants,
  updated_at = now();
