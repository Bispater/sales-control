-- =====================================================================
-- Falta la política de UPDATE en public.ventas.
-- Sin ella, "Aprobar venta" (cambiar tipo_movimiento a 'Venta') desde la
-- app no persiste, porque RLS bloquea el UPDATE con la publishable key.
-- Ejecutar en Supabase Studio → SQL Editor.
-- =====================================================================

drop policy if exists "ventas_update_anon" on public.ventas;

create policy "ventas_update_anon" on public.ventas
  for update using (true) with check (true);
