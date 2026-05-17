-- =============================================
-- GESTOR 3D — Schema Supabase
-- Ejecutar en: Supabase → SQL Editor → New query
-- =============================================

-- CLIENTES
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  notas text,
  created_at timestamptz default now()
);

-- PRODUCTOS
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text default 'General',
  precio numeric not null default 0,
  stock integer default 0,
  costo_material numeric default 0,
  tiempo_horas numeric default 0,
  notas text,
  created_at timestamptz default now()
);

-- INSUMOS
create table if not exists insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null check (categoria in ('impresion', 'post_procesado', 'packaging')),
  costo_por_pieza numeric not null default 0,
  unidad text default 'unidad',
  activo_por_defecto boolean default false,
  created_at timestamptz default now()
);

-- PRESUPUESTOS
create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  cliente_id uuid references clientes(id),
  cliente_nombre text,
  estado text default 'borrador' check (estado in ('borrador', 'enviado', 'aceptado', 'rechazado')),
  modo text default 'rapido' check (modo in ('rapido', 'calculadora')),
  fecha_entrega date,
  descuento_porcentaje numeric default 0,
  notas text,
  -- totales calculados
  costo_base numeric default 0,
  precio_venta numeric not null default 0,
  -- campos calculadora
  horas_impresion numeric default 0,
  minutos_impresion numeric default 0,
  precio_kwh numeric default 140,
  consumo_maquina_w numeric default 120,
  vida_util_repuestos_hs numeric default 4320,
  costo_repuestos numeric default 150000,
  insumos_adicionales numeric default 0,
  margen_error_pct numeric default 10,
  multiplicador numeric default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ITEMS DEL PRESUPUESTO
create table if not exists presupuesto_items (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid references presupuestos(id) on delete cascade,
  tipo text not null check (tipo in ('producto', 'personalizado')),
  producto_id uuid references productos(id),
  descripcion text not null,
  notas text,
  cantidad integer default 1,
  precio_unitario numeric not null default 0,
  created_at timestamptz default now()
);

-- FILAMENTOS DEL PRESUPUESTO (modo calculadora)
create table if not exists presupuesto_filamentos (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid references presupuestos(id) on delete cascade,
  nombre text not null,
  costo_por_kg numeric not null default 0,
  gramos numeric not null default 0,
  desperdicio_pct numeric default 10,
  created_at timestamptz default now()
);

-- INSUMOS USADOS EN PRESUPUESTO
create table if not exists presupuesto_insumos (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid references presupuestos(id) on delete cascade,
  insumo_id uuid references insumos(id),
  nombre text not null,
  costo_por_pieza numeric not null default 0,
  cantidad_piezas integer default 1,
  activo boolean default true,
  created_at timestamptz default now()
);

-- RLS (Row Level Security) — desactivado para empezar simple
alter table clientes disable row level security;
alter table productos disable row level security;
alter table insumos disable row level security;
alter table presupuestos disable row level security;
alter table presupuesto_items disable row level security;
alter table presupuesto_filamentos disable row level security;
alter table presupuesto_insumos disable row level security;

-- DATOS DE EJEMPLO — insumos predeterminados
insert into insumos (nombre, categoria, costo_por_pieza, unidad, activo_por_defecto) values
  ('Aerosol adhesivo (laca)', 'impresion', 150, 'puff', true),
  ('Gas para soplete', 'impresion', 80, 'uso', true),
  ('Cianocrilato', 'post_procesado', 220, 'gota', false),
  ('Bolsa con cierre', 'packaging', 90, 'unidad', false),
  ('Caja de cartón pequeña', 'packaging', 350, 'unidad', false);
