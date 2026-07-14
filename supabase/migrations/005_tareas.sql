-- =====================================================================
-- Tabla `tareas`: tareas asignadas a vendedores, compartidas entre el
-- dashboard web y la app móvil. Antes vivían en localStorage / SharedPreferences.
-- tipo/prioridad/estado se guardan como texto canónico (español) para que
-- ambas plataformas los interpreten igual. Ejecutar después de 004_clientes.sql.
-- =====================================================================

create table if not exists public.tareas (
  id                 text primary key,       -- id generado por el cliente ("t...")
  titulo             text not null,
  descripcion        text,
  tipo               text not null default 'Otro',        -- Producto Foco | Ruta | Venta Específica | Otro
  prioridad          text not null default 'Media',       -- Alta | Media | Baja
  estado             text not null default 'Pendiente',   -- Pendiente | En Progreso | Completada
  vendedor           text,
  cliente            text,                    -- nombre del cliente asociado (opcional)
  fecha_vencimiento  text,                    -- YYYY-MM-DD
  fecha_completada   text,                    -- YYYY-MM-DD
  created_at         timestamptz default now()
);

create index if not exists idx_tareas_vendedor on public.tareas (vendedor);
create index if not exists idx_tareas_estado   on public.tareas (estado);

-- =====================================================================
-- RLS abierta (mismo modelo que ventas/clientes hasta migrar a Supabase Auth)
-- =====================================================================
alter table public.tareas enable row level security;

drop policy if exists "tareas_select_anon" on public.tareas;
drop policy if exists "tareas_insert_anon" on public.tareas;
drop policy if exists "tareas_update_anon" on public.tareas;
drop policy if exists "tareas_delete_anon" on public.tareas;

create policy "tareas_select_anon" on public.tareas for select using (true);
create policy "tareas_insert_anon" on public.tareas for insert with check (true);
create policy "tareas_update_anon" on public.tareas for update using (true) with check (true);
create policy "tareas_delete_anon" on public.tareas for delete using (true);
