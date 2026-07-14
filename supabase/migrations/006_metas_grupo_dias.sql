-- =====================================================================
-- Metas por grupo (HOLDING / TERCEROS / TRABAJADORES) y días laborales por
-- mes, para las proyecciones de venta y el cumplimiento proyectado.
-- Ejecutar después de 005_tareas.sql.
-- =====================================================================

-- ----- 1) metas_grupo: meta mensual por grupo (independiente del vendedor) --
create table if not exists public.metas_grupo (
  grupo       text not null,               -- HOLDING | TERCEROS | TRABAJADORES
  anio        int  not null,
  mes         int  not null check (mes between 1 and 12),
  meta_clp    numeric(18, 0) not null default 0,
  created_at  timestamptz default now(),
  primary key (grupo, anio, mes)
);

create index if not exists idx_metas_grupo_anio on public.metas_grupo (anio);

-- ----- 2) dias_laborales: días hábiles por mes para proyectar -------------
create table if not exists public.dias_laborales (
  anio        int  not null,
  mes         int  not null check (mes between 1 and 12),
  dias        int  not null default 0,     -- días laborales del mes
  created_at  timestamptz default now(),
  primary key (anio, mes)
);

create index if not exists idx_dias_laborales_anio on public.dias_laborales (anio);

-- =====================================================================
-- RLS abierta (mismo modelo que el resto de tablas)
-- =====================================================================
alter table public.metas_grupo    enable row level security;
alter table public.dias_laborales enable row level security;

drop policy if exists "mg_select_anon" on public.metas_grupo;
drop policy if exists "mg_insert_anon" on public.metas_grupo;
drop policy if exists "mg_update_anon" on public.metas_grupo;
drop policy if exists "mg_delete_anon" on public.metas_grupo;

create policy "mg_select_anon" on public.metas_grupo for select using (true);
create policy "mg_insert_anon" on public.metas_grupo for insert with check (true);
create policy "mg_update_anon" on public.metas_grupo for update using (true) with check (true);
create policy "mg_delete_anon" on public.metas_grupo for delete using (true);

drop policy if exists "dl_select_anon" on public.dias_laborales;
drop policy if exists "dl_insert_anon" on public.dias_laborales;
drop policy if exists "dl_update_anon" on public.dias_laborales;
drop policy if exists "dl_delete_anon" on public.dias_laborales;

create policy "dl_select_anon" on public.dias_laborales for select using (true);
create policy "dl_insert_anon" on public.dias_laborales for insert with check (true);
create policy "dl_update_anon" on public.dias_laborales for update using (true) with check (true);
create policy "dl_delete_anon" on public.dias_laborales for delete using (true);
