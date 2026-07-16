-- =====================================================================
-- Acceso de SOLO LECTURA para el chat con IA.
--
-- La garantía real no es el filtro de texto: es que la función corre como
-- `ia_readonly`, un rol que sólo tiene GRANT SELECT. Aunque el modelo
-- generara un DELETE, Postgres lo rechaza por permisos.
--
-- Ejecutar en Supabase Studio → SQL Editor.
-- =====================================================================

-- ----- 1) Rol sin login, sólo lectura -------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ia_readonly') then
    create role ia_readonly nologin;
  end if;
end
$$;

-- `postgres` debe ser miembro del rol para poder cederle la propiedad de la función.
grant ia_readonly to postgres;

grant usage on schema public to ia_readonly;

grant select on
  public.ventas,
  public.clientes,
  public.clientes_categoria,
  public.tareas,
  public.visitas,
  public.metas_vendedor,
  public.metas_grupo,
  public.dias_laborales
to ia_readonly;

-- Que NO tenga nada más, ni ahora ni en tablas futuras.
alter default privileges in schema public revoke all on tables from ia_readonly;

-- ----- 2) Función que ejecuta la consulta ---------------------------------
create or replace function public.ia_consultar(consulta text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  q     text := btrim(consulta);
  filas jsonb;
begin
  -- Defensa 1: sólo lectura.
  if q !~* '^\s*(select|with)\s' then
    raise exception 'Sólo se permiten consultas SELECT.';
  end if;

  -- Quita el punto y coma final (y el espacio que pueda quedar detrás).
  q := btrim(rtrim(q, ';'));

  -- Defensa 2: una sola sentencia (evita "select 1; drop table ...").
  if q like '%;%' then
    raise exception 'Sólo se permite una sentencia por consulta.';
  end if;

  -- Defensa 3: sin palabras de escritura. Redundante con los permisos del
  -- rol, pero da un error legible que el modelo puede corregir solo.
  -- `into` va en la lista porque `select * into nueva from ventas` crea una
  -- tabla y empezaría con "select", saltándose la defensa 1.
  if q ~* '\y(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|into)\y' then
    raise exception 'La consulta contiene una palabra no permitida (sólo lectura).';
  end if;

  -- Una consulta pesada no puede colgar la base.
  set local statement_timeout = '8s';

  -- El LIMIT externo acota lo que vuelve al modelo (y lo que se paga en tokens).
  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) sub limit 500) t',
    q
  ) into filas;

  return filas;
end;
$$;

-- `ALTER ... OWNER TO` exige que el nuevo dueño tenga CREATE sobre el esquema.
-- Se lo prestamos sólo para esta sentencia y se lo quitamos en la línea
-- siguiente: para EJECUTAR la función, ia_readonly no necesita CREATE.
-- Si se lo dejáramos puesto, `select ... into tabla_nueva` sería una escritura.
grant create on schema public to ia_readonly;
alter function public.ia_consultar(text) owner to ia_readonly;
revoke create on schema public from ia_readonly;

-- Nadie la invoca desde el navegador: sólo el Edge Function (service_role).
revoke all on function public.ia_consultar(text) from public;
revoke all on function public.ia_consultar(text) from anon, authenticated;
grant execute on function public.ia_consultar(text) to service_role;
