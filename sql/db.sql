-- Base de datos (lógica) "restaurante_ordenes_db"
-- Tablas: clientes, ordenes

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefono VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS ordenes (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  platillo_nombre VARCHAR(255) NOT NULL,
  notas TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'pending',
  creado TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ordenes_estado_check CHECK (estado IN ('pending','preparing','delivered'))
);

CREATE INDEX IF NOT EXISTS idx_ordenes_cliente_id ON ordenes(cliente_id);
