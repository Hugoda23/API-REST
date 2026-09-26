const crypto = require('node:crypto');
const express = require('express');
const { pool } = require('./db');
const productos = require('./routes/productos');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// CORS abierto para que cualquier frontend pueda consumir la API.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Si hay API_KEY, las escrituras la exigen en el encabezado X-API-Key.
// Las lecturas (GET) quedan públicas.
function exigirApiKey(req, res, next) {
  const clave = process.env.API_KEY;
  if (!clave || req.method === 'GET') return next();
  const enviada = Buffer.from(req.get('X-API-Key') || '');
  const esperada = Buffer.from(clave);
  if (enviada.length === esperada.length && crypto.timingSafeEqual(enviada, esperada)) {
    return next();
  }
  res.status(401).json({ mensaje: 'Falta o es incorrecta la cabecera X-API-Key.' });
}

app.get('/api', (req, res) => {
  res.json({
    nombre: 'API-REST',
    version: '1.0.0',
    recursos: { productos: '/api/productos' },
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ estado: 'ok', base_de_datos: 'ok' });
  } catch {
    res.status(503).json({ estado: 'error', base_de_datos: 'sin conexión' });
  }
});

app.use('/api/productos', exigirApiKey, productos);

app.use((req, res) => {
  res.status(404).json({ mensaje: `No existe la ruta ${req.method} ${req.path}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo no es JSON válido.' });
  }
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

module.exports = app;
