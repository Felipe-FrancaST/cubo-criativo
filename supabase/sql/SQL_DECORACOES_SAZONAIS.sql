-- ============================================================================
-- CUBO CRIATIVO — DECORAÇÕES SAZONAIS
-- Execute este arquivo uma única vez no Supabase SQL Editor.
--
-- O site lê esta configuração somente pela API pública /api/seasonal-theme.
-- As alterações são feitas pela API administrativa e exigem Nível 3 — Proprietário.
-- ============================================================================

begin;

create table if not exists public.site_seasonal_theme (
  id text primary key default 'default',
  enabled boolean not null default false,
  theme text not null default 'christmas',
  intensity text not null default 'elegant',
  animations_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint site_seasonal_theme_singleton_check
    check (id = 'default'),
  constraint site_seasonal_theme_theme_check
    check (theme in ('christmas', 'sao_joao', 'easter', 'halloween', 'carnival')),
  constraint site_seasonal_theme_intensity_check
    check (intensity in ('subtle', 'elegant', 'festive'))
);

comment on table public.site_seasonal_theme is
  'Configuração única das decorações sazonais exibidas no site público.';
comment on column public.site_seasonal_theme.theme is
  'Temas: christmas, sao_joao, easter, halloween ou carnival.';
comment on column public.site_seasonal_theme.intensity is
  'Intensidade visual: subtle, elegant ou festive.';

insert into public.site_seasonal_theme (
  id,
  enabled,
  theme,
  intensity,
  animations_enabled
)
values (
  'default',
  false,
  'christmas',
  'elegant',
  true
)
on conflict (id) do nothing;

create or replace function public.set_site_seasonal_theme_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_seasonal_theme_set_updated_at
  on public.site_seasonal_theme;

create trigger site_seasonal_theme_set_updated_at
before update on public.site_seasonal_theme
for each row
execute function public.set_site_seasonal_theme_updated_at();

alter table public.site_seasonal_theme enable row level security;

-- A leitura pública e a escrita administrativa passam pelas APIs do projeto,
-- que usam a service role no servidor. O navegador não altera a tabela direto.
revoke all on table public.site_seasonal_theme from anon, authenticated;
grant all on table public.site_seasonal_theme to service_role;

commit;

-- Conferência opcional:
-- select * from public.site_seasonal_theme where id = 'default';
