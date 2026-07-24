-- Facturas AR IA — migracion inicial
-- Tablas: usuarios (perfil sobre auth.users), sesiones_carga, archivos,
-- facturas, productos. Row Level Security en todas. Ver ARQUITECTURA.md §3.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- usuarios: perfil que extiende auth.users (Supabase Auth maneja login)
-- ---------------------------------------------------------------------
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null default 'operador' check (rol in ('admin', 'operador')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Crea automaticamente el perfil cuando se registra un usuario en Supabase Auth.
create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.email),
    'operador'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.manejar_nuevo_usuario();

-- ---------------------------------------------------------------------
-- sesiones_carga: agrupa un lote de subida (compra/venta elegido una vez)
-- ---------------------------------------------------------------------
create table public.sesiones_carga (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  clasificacion text not null check (clasificacion in ('compra', 'venta')),
  creado_en timestamptz not null default now()
);

create index sesiones_carga_usuario_idx on public.sesiones_carga (usuario_id);

-- ---------------------------------------------------------------------
-- archivos: cada PDF/imagen subido
-- ---------------------------------------------------------------------
create table public.archivos (
  id uuid primary key default gen_random_uuid(),
  sesion_carga_id uuid not null references public.sesiones_carga (id) on delete cascade,
  nombre_original text not null,
  nombre_normalizado text,
  ruta_storage text not null,
  tipo_mime text not null,
  tamano_bytes integer not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'procesado', 'error')),
  error_mensaje text,
  creado_en timestamptz not null default now()
);

create index archivos_sesion_idx on public.archivos (sesion_carga_id);

-- ---------------------------------------------------------------------
-- facturas: un comprobante procesado (1:1 con archivos)
-- ---------------------------------------------------------------------
create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  archivo_id uuid not null unique references public.archivos (id) on delete cascade,
  sesion_carga_id uuid not null references public.sesiones_carga (id) on delete cascade,

  -- Comprobante
  tipo_comprobante text not null check (tipo_comprobante in (
    'factura_a', 'factura_b', 'factura_c', 'factura_m', 'factura_e',
    'nc_a', 'nc_b', 'nc_c', 'nd_a', 'nd_b', 'nd_c',
    'recibo', 'ticket', 'otro'
  )),
  letra text,
  codigo_afip text,
  punto_venta text,
  numero text,
  fecha_emision date,
  fecha_pago date,
  periodo_desde date,
  periodo_hasta date,
  moneda text,
  condicion_venta text,

  -- Emisor
  emisor_razon_social text,
  emisor_nombre_comercial text,
  emisor_cuit text,
  emisor_direccion text,
  emisor_localidad text,
  emisor_provincia text,
  emisor_codigo_postal text,
  emisor_condicion_iva text,
  emisor_ingresos_brutos text,
  emisor_fecha_inicio_actividades date,

  -- Receptor (cliente)
  cliente_razon_social text,
  cliente_cuit text,
  cliente_direccion text,
  cliente_localidad text,
  cliente_provincia text,
  cliente_condicion_iva text,

  -- Datos fiscales
  cae text,
  cae_vencimiento date,
  qr_data text,

  -- Impuestos (vacio si no existe, nunca 0 inventado)
  importe_neto_gravado numeric(14, 2),
  iva_27 numeric(14, 2),
  iva_21 numeric(14, 2),
  iva_105 numeric(14, 2),
  iva_5 numeric(14, 2),
  iva_25 numeric(14, 2),
  iva_exento numeric(14, 2),
  iva_no_gravado numeric(14, 2),
  percepcion_iva numeric(14, 2),
  percepcion_iibb numeric(14, 2),
  percepcion_municipal numeric(14, 2),
  impuestos_internos numeric(14, 2),
  otros_tributos numeric(14, 2),
  descuentos numeric(14, 2),
  total numeric(14, 2),

  -- Meta-datos de procesamiento
  confianza_porcentaje integer check (confianza_porcentaje between 0 and 100),
  estado text not null default 'revision' check (estado in ('revision', 'validada', 'error')),
  duplicada boolean not null default false,
  errores_detectados jsonb not null default '[]'::jsonb,
  extraccion_raw jsonb,
  observaciones text,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index facturas_duplicados_idx
  on public.facturas (emisor_cuit, tipo_comprobante, punto_venta, numero);
create index facturas_fecha_idx on public.facturas (fecha_emision);
create index facturas_sesion_idx on public.facturas (sesion_carga_id);

create or replace function public.set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger facturas_actualizado_en
before update on public.facturas
for each row execute function public.set_actualizado_en();

-- ---------------------------------------------------------------------
-- productos: lineas de detalle de cada factura
-- ---------------------------------------------------------------------
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  orden integer not null default 0,
  codigo text,
  descripcion text not null,
  cantidad numeric(14, 4),
  unidad text,
  precio_unitario numeric(14, 4),
  bonificacion_pct numeric(6, 2),
  bonificacion_monto numeric(14, 2),
  alicuota_iva numeric(6, 2),
  subtotal numeric(14, 2),
  subtotal_con_iva numeric(14, 2)
);

create index productos_factura_idx on public.productos (factura_id);

-- ---------------------------------------------------------------------
-- Row Level Security: cada usuario ve lo que subio; admin ve todo.
-- ---------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.sesiones_carga enable row level security;
alter table public.archivos enable row level security;
alter table public.facturas enable row level security;
alter table public.productos enable row level security;

create or replace function public.es_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and rol = 'admin' and activo = true
  );
$$;

create policy usuarios_select on public.usuarios
  for select using (id = auth.uid() or public.es_admin());

create policy usuarios_update_propio on public.usuarios
  for update using (id = auth.uid());

create policy sesiones_carga_all on public.sesiones_carga
  for all
  using (usuario_id = auth.uid() or public.es_admin())
  with check (usuario_id = auth.uid() or public.es_admin());

create policy archivos_all on public.archivos
  for all
  using (exists (
    select 1 from public.sesiones_carga sc
    where sc.id = sesion_carga_id and (sc.usuario_id = auth.uid() or public.es_admin())
  ))
  with check (exists (
    select 1 from public.sesiones_carga sc
    where sc.id = sesion_carga_id and (sc.usuario_id = auth.uid() or public.es_admin())
  ));

create policy facturas_all on public.facturas
  for all
  using (exists (
    select 1 from public.sesiones_carga sc
    where sc.id = sesion_carga_id and (sc.usuario_id = auth.uid() or public.es_admin())
  ))
  with check (exists (
    select 1 from public.sesiones_carga sc
    where sc.id = sesion_carga_id and (sc.usuario_id = auth.uid() or public.es_admin())
  ));

create policy productos_all on public.productos
  for all
  using (exists (
    select 1 from public.facturas f
    join public.sesiones_carga sc on sc.id = f.sesion_carga_id
    where f.id = factura_id and (sc.usuario_id = auth.uid() or public.es_admin())
  ))
  with check (exists (
    select 1 from public.facturas f
    join public.sesiones_carga sc on sc.id = f.sesion_carga_id
    where f.id = factura_id and (sc.usuario_id = auth.uid() or public.es_admin())
  ));

-- ---------------------------------------------------------------------
-- Storage: bucket privado para los PDF/imagenes originales.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

create policy facturas_storage_select on storage.objects
  for select using (bucket_id = 'facturas' and auth.uid() is not null);

create policy facturas_storage_insert on storage.objects
  for insert with check (bucket_id = 'facturas' and auth.uid() is not null);

create policy facturas_storage_update on storage.objects
  for update using (bucket_id = 'facturas' and auth.uid() is not null);

create policy facturas_storage_delete on storage.objects
  for delete using (bucket_id = 'facturas' and auth.uid() is not null);
