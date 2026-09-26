const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const CAMPOS = ['nombre', 'descripcion', 'precio', 'stock'];

// Devuelve { datos, errores }. Con `parcial` (PATCH) sólo valida lo que venga.
function validar(body, { parcial = false } = {}) {
  const errores = {};
  const datos = {};
  body = body || {};

  if (body.nombre !== undefined || !parcial) {
    if (typeof body.nombre !== 'string' || body.nombre.trim() === '') {
      errores.nombre = 'El nombre es obligatorio.';
    } else if (body.nombre.trim().length > 120) {
      errores.nombre = 'El nombre no puede pasar de 120 caracteres.';
    } else {
      datos.nombre = body.nombre.trim();
    }
  }

  if (body.descripcion !== undefined) {
    if (body.descripcion !== null && typeof body.descripcion !== 'string') {
      errores.descripcion = 'La descripción debe ser texto.';
    } else {
      datos.descripcion = body.descripcion;
    }
  } else if (!parcial) {
    datos.descripcion = null;
  }

  if (body.precio !== undefined || !parcial) {
    const precio = Number(body.precio);
    if (body.precio === null || body.precio === '' || !Number.isFinite(precio) || precio < 0) {
      errores.precio = 'El precio es obligatorio y debe ser un número mayor o igual a 0.';
    } else {
      datos.precio = Math.round(precio * 100) / 100;
    }
  }

  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      errores.stock = 'El stock debe ser un entero mayor o igual a 0.';
    } else {
      datos.stock = stock;
    }
  } else if (!parcial) {
    datos.stock = 0;
  }

  return { datos, errores };
}

function idValido(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ mensaje: 'El id debe ser un entero positivo.' });
    return null;
  }
  return id;
}

// GET /api/productos?buscar=&pagina=1&por_pagina=20
router.get('/', async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(req.query.por_pagina, 10) || 20));
    const buscar = (req.query.buscar || '').trim();

    const filtro = buscar ? 'WHERE nombre ILIKE $1' : '';
    const params = buscar ? [`%${buscar}%`] : [];

    const total = await pool.query(`SELECT count(*)::int AS total FROM productos ${filtro}`, params);
    const filas = await pool.query(
      `SELECT * FROM productos ${filtro} ORDER BY id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, porPagina, (pagina - 1) * porPagina],
    );

    res.json({
      datos: filas.rows,
      meta: {
        pagina,
        por_pagina: porPagina,
        total: total.rows[0].total,
        paginas: Math.ceil(total.rows[0].total / porPagina),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  const id = idValido(req, res);
  if (id === null) return;
  try {
    const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    res.json({ datos: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const { datos, errores } = validar(req.body);
  if (Object.keys(errores).length) {
    return res.status(422).json({ mensaje: 'Datos inválidos.', errores });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, stock)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [datos.nombre, datos.descripcion, datos.precio, datos.stock],
    );
    res.status(201).location(`${req.baseUrl}/${rows[0].id}`).json({ datos: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT reemplaza el recurso completo; PATCH actualiza sólo los campos enviados.
async function actualizar(req, res, next, parcial) {
  const id = idValido(req, res);
  if (id === null) return;

  const { datos, errores } = validar(req.body, { parcial });
  if (Object.keys(errores).length) {
    return res.status(422).json({ mensaje: 'Datos inválidos.', errores });
  }
  const campos = CAMPOS.filter((c) => datos[c] !== undefined);
  if (!campos.length) {
    return res.status(422).json({ mensaje: 'No se envió ningún campo para actualizar.' });
  }

  try {
    const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE productos SET ${sets}, actualizado_en = now()
       WHERE id = $${campos.length + 1} RETURNING *`,
      [...campos.map((c) => datos[c]), id],
    );
    if (!rows.length) return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    res.json({ datos: rows[0] });
  } catch (err) {
    next(err);
  }
}

router.put('/:id', (req, res, next) => actualizar(req, res, next, false));
router.patch('/:id', (req, res, next) => actualizar(req, res, next, true));

router.delete('/:id', async (req, res, next) => {
  const id = idValido(req, res);
  if (id === null) return;
  try {
    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
