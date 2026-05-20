-- =====================================================================
-- Esquema control-ventas - tabla ventas
-- Ejecutar en Supabase Studio → SQL Editor.
-- =====================================================================

create table if not exists public.ventas (
  id                    bigserial primary key,

  -- Derivados desde fecha_emision en la ingesta
  anio                  int not null,
  mes                   int,
  dia                   int,

  tipo_movimiento       text,
  tipo_documento        text,
  numero_documento      text,
  fecha_emision         text,
  tracking_number       text,
  fecha_hora_venta      text,
  sucursal              text,
  vendedor              text,

  nombre_cliente        text,
  cliente_rut           text,
  email_cliente         text,
  cliente_direccion     text,
  cliente_comuna        text,
  cliente_ciudad        text,

  lista_precio          text,
  tipo_entrega          text,
  moneda                text,
  tipo_producto         text,
  sku                   text,
  producto              text,
  variante              text,
  otros_atributos       text,
  marca                 text,
  detalle_pack          text,

  precio_lista          numeric(18, 4) default 0,
  precio_neto_unitario  numeric(18, 4) default 0,
  precio_bruto_unitario numeric(18, 4) default 0,
  cantidad              numeric(18, 4) default 0,
  venta_total_neta      numeric(18, 4) default 0,
  total_impuestos       numeric(18, 4) default 0,
  venta_total_bruta     numeric(18, 4) default 0,

  nombre_descuento      text,
  descuento_neto        numeric(18, 4) default 0,
  descuento_bruto       numeric(18, 4) default 0,
  pct_descuento         numeric(10, 4) default 0,

  costo_neto_unitario   numeric(18, 4) default 0,
  costo_total_neto      numeric(18, 4) default 0,
  margen                numeric(18, 4) default 0,
  pct_margen            numeric(10, 4) default 0,

  created_at            timestamptz default now()
);

create index if not exists idx_ventas_anio          on public.ventas (anio);
create index if not exists idx_ventas_anio_mes      on public.ventas (anio, mes);
create index if not exists idx_ventas_vendedor      on public.ventas (vendedor);
create index if not exists idx_ventas_cliente_rut   on public.ventas (cliente_rut);
create index if not exists idx_ventas_fecha_emision on public.ventas (fecha_emision);
create index if not exists idx_ventas_sucursal      on public.ventas (sucursal);

-- =====================================================================
-- Función auxiliar: listar años cargados con totales
-- =====================================================================
create or replace function public.listar_anios_dataset()
returns table (anio int, "totalFilas" bigint, "ultimaCarga" timestamptz)
language sql
stable
as $$
  select
    anio,
    count(*)::bigint as "totalFilas",
    max(created_at)  as "ultimaCarga"
  from public.ventas
  group by anio
  order by anio desc;
$$;

-- =====================================================================
-- RLS: como aún se usa Firebase Auth (no Supabase Auth), se autoriza
-- a la publishable key (role 'anon'). Migrar a Supabase Auth para
-- endurecer estas políticas por usuario.
-- =====================================================================
alter table public.ventas enable row level security;

drop policy if exists "ventas_select_anon" on public.ventas;
drop policy if exists "ventas_insert_anon" on public.ventas;
drop policy if exists "ventas_delete_anon" on public.ventas;

create policy "ventas_select_anon" on public.ventas for select using (true);
create policy "ventas_insert_anon" on public.ventas for insert with check (true);
create policy "ventas_delete_anon" on public.ventas for delete using (true);

-- Permitir invocar la función a anon/authenticated
grant execute on function public.listar_anios_dataset() to anon, authenticated;
