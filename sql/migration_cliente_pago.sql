-- Migración: Registro de clientes, envíos y pagos
-- Ejecutar en Supabase SQL Editor o psql

-- Rol Cliente para usuarios registrados
INSERT INTO roles (nombre) VALUES ('Cliente') ON CONFLICT (nombre) DO NOTHING;

-- Vincular usuario a cliente (para clientes registrados)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cliente_id INT REFERENCES clientes(id);

-- Campos de peso, precio y pago en paquetes
ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS peso_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_envio DECIMAL(10,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS quien_paga VARCHAR(20) DEFAULT 'remitente' CHECK (quien_paga IN ('remitente', 'destinatario')),
  ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT FALSE;
