// Aplica sql/db.sql al arrancar (para que no tengas que importar a mano)
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL;
const needSSL =
  process.env.PGSSLMODE === 'require' ||
  (dbUrl && dbUrl.includes('render.com'));

const pool = new Pool({
  connectionString: dbUrl,
  ssl: needSSL ? { rejectUnauthorized: false } : false
});

(async () => {
  try {
    if (!dbUrl) { console.log('[INIT-DB] No DATABASE_URL, skip'); process.exit(0); }
    const schemaSQL = fs.readFileSync(path.join(__dirname, '..', 'sql', 'db.sql'), 'utf8');
    console.log('[INIT-DB] Applying schema...');
    await pool.query(schemaSQL);
    console.log('[INIT-DB] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[INIT-DB] Error:', err.message);
    process.exit(1);
  }
})();
