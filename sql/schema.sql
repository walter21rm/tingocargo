-- Esquema básico para la empresa de logística y transporte

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE sucursales (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion TEXT NOT NULL
);

CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('persona', 'empresa')),
  nombre VARCHAR(120) NOT NULL,
  documento TEXT,
  telefono TEXT,
  email VARCHAR(120),
  direccion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  telefono TEXT,
  rol_id INT NOT NULL REFERENCES roles(id),
  sucursal_id INT REFERENCES sucursales(id),
  cliente_id INT REFERENCES clientes(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash VARCHAR(120) NOT NULL,
  placa VARCHAR(20),
  vehiculo VARCHAR(80),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE distribuidoras (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  razon_social VARCHAR(200),
  telefono TEXT,
  direccion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE paquetes (
  id SERIAL PRIMARY KEY,
  codigo_seguimiento VARCHAR(30) NOT NULL UNIQUE,
  tipo_envio VARCHAR(30) NOT NULL DEFAULT 'distribuidora_cliente',
  remitente_id INT REFERENCES distribuidoras(id),
  remitente_cliente_id INT REFERENCES clientes(id),
  destinatario_id INT NOT NULL REFERENCES clientes(id),
  operador_id INT REFERENCES usuarios(id),
  repartidor_id INT REFERENCES usuarios(id),
  sucursal_origen_id INT NOT NULL REFERENCES sucursales(id),
  sucursal_destino_id INT REFERENCES sucursales(id),
  destino_texto TEXT NOT NULL,
  descripcion VARCHAR(200),
  estado_actual VARCHAR(30) NOT NULL CHECK (estado_actual IN ('En Almacén', 'En Tránsito', 'Entregado', 'Intento fallido')),
  reprogramacion_fecha DATE,
  reprogramacion_hora_inicio VARCHAR(5),
  reprogramacion_hora_fin VARCHAR(5),
  reprogramacion_direccion TEXT,
  peso_kg DECIMAL(10,2) DEFAULT 0,
  precio_envio DECIMAL(10,2) DEFAULT 10,
  quien_paga VARCHAR(20) DEFAULT 'remitente' CHECK (quien_paga IN ('remitente', 'destinatario')),
  pagado BOOLEAN DEFAULT FALSE,
  metodo_pago VARCHAR(20),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE historial_estados (
  id SERIAL PRIMARY KEY,
  paquete_id INT NOT NULL REFERENCES paquetes(id),
  estado VARCHAR(30) NOT NULL CHECK (estado IN ('En Almacén', 'En Tránsito', 'Entregado', 'Intento fallido')),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacion TEXT,
  usuario_ref VARCHAR(80),
  usuario_nombre VARCHAR(120)
);

CREATE INDEX IF NOT EXISTS idx_paquetes_estado ON paquetes (estado_actual);
CREATE INDEX IF NOT EXISTS idx_paquetes_creado ON paquetes (creado_en);
CREATE INDEX IF NOT EXISTS idx_paquetes_repartidor ON paquetes (repartidor_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_codigo ON paquetes (codigo_seguimiento);
CREATE INDEX IF NOT EXISTS idx_historial_paquete ON historial_estados (paquete_id, fecha_hora);

CREATE TABLE auditoria (
  id SERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_ref VARCHAR(80),
  usuario_nombre VARCHAR(120),
  accion VARCHAR(40) NOT NULL,
  recurso VARCHAR(40),
  detalle VARCHAR(500)
);
