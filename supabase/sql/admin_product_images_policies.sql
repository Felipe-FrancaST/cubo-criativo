-- Cubo Criativo — permissões para cadastro de imagens de produtos pelo painel admin
-- Execute UMA VEZ no Supabase: SQL Editor > New query > Run.
-- O script é idempotente: pode ser executado novamente sem duplicar políticas.

begin;

-- O bucket já existe no projeto. Mantemos público para as imagens funcionarem
-- no catálogo e nas páginas individuais dos produtos.
update storage.buckets
set public = true
where id = 'product-images';

-- Apenas usuários autenticados presentes em public.admins podem gravar arquivos.
drop policy if exists "admin can upload product images" on storage.objects;
create policy "admin can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

-- Necessária para substituir/editar imagens futuramente pelo painel.
drop policy if exists "admin can update product images" on storage.objects;
create policy "admin can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

-- Permite limpeza de imagens antigas somente por administradores.
drop policy if exists "admin can delete product images" on storage.objects;
create policy "admin can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

commit;
