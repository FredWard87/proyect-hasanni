const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL establecida exitosamente');
    
    const result = await client.query('SELECT NOW()');
    console.log('🕒 Hora del servidor:', result.rows[0].now);
    
    client.release();
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    console.error('💡 Verifica que PostgreSQL esté corriendo y las credenciales sean correctas');
  }
};

// Función para ejecutar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query ejecutada:', { text: text.substring(0, 50) + '...', duration, rows: result.rowCount });
    return result;
  } catch (err) {
    console.error('❌ Error en query:', err.message);
    throw err;
  }
};

module.exports = {
  pool,
  query,
  testConnection
};