-- =====================================================================
-- Tabla `visitas`: registro de visitas del vendedor a un cliente, marcadas
-- desde la app móvil. Alimenta "Clientes Visitados" / "Clientes sin Visitar".
-- El cliente se identifica por `cliente_key` (RUT normalizado o, si no hay
-- RUT, el nombre en mayúsculas) para cubrir también clientes derivados de
-- ventas que no tienen ficha en la tabla `clientes`.
-- Ejecutar después de 006_metas_grupo_dias.sql.
-- =====================================================================

create table if not exists public.visitas (
  id             text primary key,          -- id generado por la app ("v...")
  cliente_key    text not null,
  cliente_nombre text,
  vendedor       text,
  fecha          text not null,             -- YYYY-MM-DD
  created_at     timestamptz default now()
);

create index if not exists idx_visitas_cliente on public.visitas (cliente_key);
create index if not exists idx_visitas_fecha   on public.visitas (fecha);
-- Una visita por cliente/día evita duplicados al marcar/desmarcar.
create unique index if not exists uq_visitas_cliente_fecha
  on public.visitas (cliente_key, fecha);

-- =====================================================================
-- RLS abierta (mismo modelo que el resto de tablas)
-- =====================================================================
alter table public.visitas enable row level security;

drop policy if exists "visitas_select_anon" on public.visitas;
drop policy if exists "visitas_insert_anon" on public.visitas;
drop policy if exists "visitas_update_anon" on public.visitas;
drop policy if exists "visitas_delete_anon" on public.visitas;

create policy "visitas_select_anon" on public.visitas for select using (true);
create policy "visitas_insert_anon" on public.visitas for insert with check (true);
create policy "visitas_update_anon" on public.visitas for update using (true) with check (true);
create policy "visitas_delete_anon" on public.visitas for delete using (true);
