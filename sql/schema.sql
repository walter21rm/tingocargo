-- Esquema básico para la empresa de logística y transporte

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE sucursales (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(200) NOT NULL
);

CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('persona', 'empresa')),
  nombre VARCHAR(120) NOT NULL,
  documento VARCHAR(30),
  telefono VARCHAR(30),
  email VARCHAR(120),
  direccion VARCHAR(200),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  telefono VARCHAR(30),
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
  telefono VARCHAR(30),
  direccion VARCHAR(200),
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
  destino_texto VARCHAR(200) NOT NULL,
  descripcion VARCHAR(200),
  estado_actual VARCHAR(30) NOT NULL,
  reprogramacion_fecha DATE,
  reprogramacion_hora_inicio VARCHAR(5),
  reprogramacion_hora_fin VARCHAR(5),
  reprogramacion_direccion VARCHAR(200),
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
  estado VARCHAR(30) NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacion VARCHAR(200)
);
