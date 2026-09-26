const fs = require('node:fs');
const path = require('node:path');
const { Pool, types } = require('pg');

// NUMERIC llega como string; el precio lo devolvemos como número.
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_DATABASE || 'api_rest',
  user: process.env.DB_USERNAME || 'api_rest',
  password: process.env.DB_PASSWORD || 'secret',
  max: 10,
});

async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, migrar };
