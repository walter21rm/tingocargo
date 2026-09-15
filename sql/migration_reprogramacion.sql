-- Migración: Reprogramación de envíos (intento fallido)
-- Ejecutar en Supabase SQL Editor o psql

ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS reprogramacion_fecha DATE,
  ADD COLUMN IF NOT EXISTS reprogramacion_hora_inicio VARCHAR(5),
  ADD COLUMN IF NOT EXISTS reprogramacion_hora_fin VARCHAR(5),
  ADD COLUMN IF NOT EXISTS reprogramacion_direccion VARCHAR(200);
