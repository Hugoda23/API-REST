-- Se ejecuta al arrancar la API; es idempotente.
CREATE TABLE IF NOT EXISTS productos (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(120)   NOT NULL,
    descripcion TEXT,
    precio      NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS productos_nombre_idx ON productos (lower(nombre));
