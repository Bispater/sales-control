-- =====================================================================
-- Tabla `clientes`: ficha maestra del cliente creada/editada desde la app
-- móvil y leída por el dashboard. Reemplaza el almacenamiento local
-- (SharedPreferences) para que contacto/teléfono/crédito sean visibles
-- en la web. Ejecutar después de 003_ventas_update_policy.sql.
-- =====================================================================

create table if not exists public.clientes (
  id            text primary key,          -- id generado por la app ("c...")
  rut           text,                       -- RUT normalizado (sin puntos), puede repetirse/estar vacío
  nombre        text not null,
  tipo          int  not null default 0,    -- 0 = Razón Social, 1 = Persona Natural
  contacto      text,                       -- nombre de la persona de contacto
  email         text,
  telefono      text,
  direccion     text,
  lat           double precision,
  lng           double precision,
  credito       numeric(18, 0) not null default 0,  -- cupo/monto de crédito asignado (CLP)
  notas         text,
  vendedor      text,                       -- vendedor que lo creó/atiende
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_clientes_rut      on public.clientes (rut);
create index if not exists idx_clientes_vendedor on public.clientes (vendedor);

-- Mantiene updated_at al día en cada UPDATE.
create or replace function public.clientes_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.clientes_touch_updated_at();

-- =====================================================================
-- RLS abierta (mismo modelo que ventas/metas hasta migrar a Supabase Auth)
-- =====================================================================
alter table public.clientes enable row level security;

drop policy if exists "clientes_select_anon" on public.clientes;
drop policy if exists "clientes_insert_anon" on public.clientes;
drop policy if exists "clientes_update_anon" on public.clientes;
drop policy if exists "clientes_delete_anon" on public.clientes;

create policy "clientes_select_anon" on public.clientes for select using (true);
create policy "clientes_insert_anon" on public.clientes for insert with check (true);
create policy "clientes_update_anon" on public.clientes for update using (true) with check (true);
create policy "clientes_delete_anon" on public.clientes for delete using (true);
