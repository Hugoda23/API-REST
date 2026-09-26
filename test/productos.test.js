// Corre contra una base aparte (api_rest_test) para no tocar la de desarrollo:
//   DB_PORT=5436 DB_DATABASE=api_rest_test npm test
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.DB_DATABASE ||= 'api_rest_test';
if (!process.env.DB_DATABASE.endsWith('_test')) {
  throw new Error('Las pruebas vacían la tabla: usa una base cuyo nombre termine en _test.');
}

const app = require('../src/app');
const { pool, migrar } = require('../src/db');

before(migrar);
beforeEach(() => pool.query('TRUNCATE productos RESTART IDENTITY'));
after(() => pool.end());

const nuevo = { nombre: 'Teclado', descripcion: 'Mecánico', precio: 350.5, stock: 10 };

test('GET /api/health responde ok', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.estado, 'ok');
});

test('POST crea un producto', async () => {
  const res = await request(app).post('/api/productos').send(nuevo).expect(201);
  assert.equal(res.headers.location, '/api/productos/1');
  assert.equal(res.body.datos.nombre, 'Teclado');
  assert.equal(res.body.datos.precio, 350.5);
  assert.equal(res.body.datos.stock, 10);
});

test('POST valida los campos', async () => {
  const res = await request(app).post('/api/productos').send({ precio: -1 }).expect(422);
  assert.ok(res.body.errores.nombre);
  assert.ok(res.body.errores.precio);
});

test('POST con JSON roto da 400', async () => {
  await request(app)
    .post('/api/productos')
    .set('Content-Type', 'application/json')
    .send('{"nombre":')
    .expect(400);
});

test('GET lista con paginación y búsqueda', async () => {
  await request(app).post('/api/productos').send(nuevo);
  await request(app).post('/api/productos').send({ nombre: 'Mouse', precio: 90 });

  const todos = await request(app).get('/api/productos').expect(200);
  assert.equal(todos.body.meta.total, 2);

  const filtrados = await request(app).get('/api/productos?buscar=mou').expect(200);
  assert.equal(filtrados.body.datos.length, 1);
  assert.equal(filtrados.body.datos[0].nombre, 'Mouse');

  const pagina2 = await request(app).get('/api/productos?por_pagina=1&pagina=2').expect(200);
  assert.equal(pagina2.body.datos[0].nombre, 'Mouse');
  assert.equal(pagina2.body.meta.paginas, 2);
});

test('GET /:id devuelve uno, 404 si no existe, 400 si el id no es válido', async () => {
  await request(app).post('/api/productos').send(nuevo);
  const res = await request(app).get('/api/productos/1').expect(200);
  assert.equal(res.body.datos.nombre, 'Teclado');
  await request(app).get('/api/productos/999').expect(404);
  await request(app).get('/api/productos/abc').expect(400);
});

test('PUT reemplaza y PATCH actualiza parcialmente', async () => {
  await request(app).post('/api/productos').send(nuevo);

  const put = await request(app)
    .put('/api/productos/1')
    .send({ nombre: 'Teclado 2', precio: 400 })
    .expect(200);
  assert.equal(put.body.datos.nombre, 'Teclado 2');
  assert.equal(put.body.datos.stock, 0);
  assert.equal(put.body.datos.descripcion, null);

  const patch = await request(app).patch('/api/productos/1').send({ stock: 5 }).expect(200);
  assert.equal(patch.body.datos.stock, 5);
  assert.equal(patch.body.datos.nombre, 'Teclado 2');

  await request(app).patch('/api/productos/1').send({}).expect(422);
  await request(app).put('/api/productos/999').send(nuevo).expect(404);
});

test('DELETE elimina', async () => {
  await request(app).post('/api/productos').send(nuevo);
  await request(app).delete('/api/productos/1').expect(204);
  await request(app).get('/api/productos/1').expect(404);
  await request(app).delete('/api/productos/1').expect(404);
});

test('con API_KEY, las escrituras la exigen y las lecturas no', async () => {
  process.env.API_KEY = 'clave-de-prueba';
  try {
    await request(app).post('/api/productos').send(nuevo).expect(401);
    await request(app)
      .post('/api/productos')
      .set('X-API-Key', 'clave-de-prueba')
      .send(nuevo)
      .expect(201);
    await request(app).get('/api/productos').expect(200);
  } finally {
    delete process.env.API_KEY;
  }
});

test('ruta inexistente da 404 en JSON', async () => {
  const res = await request(app).get('/api/nada').expect(404);
  assert.match(res.body.mensaje, /No existe la ruta/);
});
