-- Migración para Supabase: Portal de clientes, peso, precio y pago
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Pegar y Run

-- 1. Rol Cliente (si no existe)
INSERT INTO roles (nombre)
VALUES ('Cliente')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Columna cliente_id en usuarios (vincula usuario registrado con su cliente)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS cliente_id INT REFERENCES clientes(id);

-- 3. Campos de peso, precio y pago en paquetes
ALTER TABLE paquetes
ADD COLUMN IF NOT EXISTS peso_kg DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS precio_envio DECIMAL(10,2) DEFAULT 10,
ADD COLUMN IF NOT EXISTS quien_paga VARCHAR(20) DEFAULT 'remitente' CHECK (quien_paga IN ('remitente', 'destinatario')),
ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20);

-- metodo_pago: 'tarjeta' | 'yape' | 'efectivo' (cuando pagado = true)

-- 4. Placa y vehículo para repartidores
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS placa VARCHAR(20),
ADD COLUMN IF NOT EXISTS vehiculo VARCHAR(80);
