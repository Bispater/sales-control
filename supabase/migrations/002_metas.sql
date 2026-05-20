-- =====================================================================
-- Tablas auxiliares: categoría de clientes + metas mensuales de vendedores.
-- Ejecutar después de 001_init.sql en el SQL Editor de Supabase.
-- =====================================================================

-- ----- 1) clientes_categoria: RUT → HOLDING/TRABAJADORES/TERCEROS --------
create table if not exists public.clientes_categoria (
  rut         text primary key,
  nombre      text,
  categoria   text not null,
  created_at  timestamptz default now()
);

create index if not exists idx_clientes_categoria_categoria
  on public.clientes_categoria (categoria);

-- ----- 2) metas_vendedor: meta total por mes ----------------------------
create table if not exists public.metas_vendedor (
  vendedor    text not null,
  anio        int  not null,
  mes         int  not null check (mes between 1 and 12),
  meta_clp    numeric(18, 0) not null default 0,
  categoria   text,
  created_at  timestamptz default now(),
  primary key (vendedor, anio, mes)
);

create index if not exists idx_metas_vendedor_anio     on public.metas_vendedor (anio);
create index if not exists idx_metas_vendedor_anio_mes on public.metas_vendedor (anio, mes);

-- =====================================================================
-- RLS abierta (mismo modelo que ventas hasta migrar a Supabase Auth)
-- =====================================================================
alter table public.clientes_categoria enable row level security;
alter table public.metas_vendedor      enable row level security;

drop policy if exists "cat_select_anon" on public.clientes_categoria;
drop policy if exists "cat_insert_anon" on public.clientes_categoria;
drop policy if exists "cat_update_anon" on public.clientes_categoria;
drop policy if exists "cat_delete_anon" on public.clientes_categoria;

create policy "cat_select_anon" on public.clientes_categoria for select using (true);
create policy "cat_insert_anon" on public.clientes_categoria for insert with check (true);
create policy "cat_update_anon" on public.clientes_categoria for update using (true) with check (true);
create policy "cat_delete_anon" on public.clientes_categoria for delete using (true);

drop policy if exists "met_select_anon" on public.metas_vendedor;
drop policy if exists "met_insert_anon" on public.metas_vendedor;
drop policy if exists "met_update_anon" on public.metas_vendedor;
drop policy if exists "met_delete_anon" on public.metas_vendedor;

create policy "met_select_anon" on public.metas_vendedor for select using (true);
create policy "met_insert_anon" on public.metas_vendedor for insert with check (true);
create policy "met_update_anon" on public.metas_vendedor for update using (true) with check (true);
create policy "met_delete_anon" on public.metas_vendedor for delete using (true);
