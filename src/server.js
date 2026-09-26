const app = require('./app');
const { pool, migrar } = require('./db');

const PORT = Number(process.env.PORT || 3000);

async function arrancar() {
  // La base puede tardar unos segundos en aceptar conexiones al levantar Docker.
  for (let intento = 1; ; intento++) {
    try {
      await migrar();
      break;
    } catch (err) {
      if (intento >= 15) throw err;
      console.log(`Base de datos no disponible (intento ${intento}), reintentando...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const server = app.listen(PORT, () => console.log(`API-REST escuchando en el puerto ${PORT}`));

  const cerrar = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGTERM', cerrar);
  process.on('SIGINT', cerrar);
}

arrancar().catch((err) => {
  console.error('No se pudo arrancar:', err);
  process.exit(1);
});
