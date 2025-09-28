require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// DB (Render -> SSL)
const dbUrl = process.env.DATABASE_URL;
const needSSL =
    process.env.PGSSLMODE === 'require' ||
    (dbUrl && dbUrl.includes('render.com'));

const pool = new Pool({
    connectionString: dbUrl,
    ssl: needSSL ? { rejectUnauthorized: false } : false
});

// Utilidad para avanzar estado
const nextEstado = (s) => s === 'pending' ? 'preparing' : (s === 'preparing' ? 'delivered' : 'delivered');

// Healthcheck
app.get('/health', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ========== ENDPOINTS SOLICITADOS ========== */

/* 1) POST /clientes/registrar  */
app.post('/clientes/registrar', async (req, res) => {
    try {
        const { nombre, email, telefono } = req.body || {};
        if (!nombre || !email || !telefono) return res.status(400).json({ error: 'nombre, email y telefono son requeridos' });
        const exists = await pool.query('SELECT id FROM clientes WHERE email=$1', [email]);
        if (exists.rowCount) return res.status(409).json({ error: 'Email ya registrado' });
        const q = await pool.query(
            'INSERT INTO clientes(nombre,email,telefono) VALUES ($1,$2,$3) RETURNING id,nombre,email,telefono',
            [nombre, email, telefono]
        );
        res.status(201).json(q.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 2) POST /clientes/login  (email + telefono) */
app.post('/clientes/login', async (req, res) => {
    try {
        const { email, telefono } = req.body || {};
        if (!email || !telefono) return res.status(400).json({ error: 'email y telefono son requeridos' });
        const q = await pool.query('SELECT id,nombre,email,telefono FROM clientes WHERE email=$1 AND telefono=$2', [email, telefono]);
        if (!q.rowCount) return res.status(401).json({ error: 'Credenciales inválidas' });
        res.json(q.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 3) POST /ordenes  (crear pedido para un cliente) */
app.post('/ordenes', async (req, res) => {
    try {
        const { cliente_id, platillo_nombre, notas } = req.body || {};
        if (!cliente_id || !platillo_nombre) return res.status(400).json({ error: 'cliente_id y platillo_nombre son requeridos' });
        const ins = await pool.query(
            'INSERT INTO ordenes(cliente_id,platillo_nombre,notas) VALUES ($1,$2,$3) RETURNING id,cliente_id,platillo_nombre,notas,estado,creado',
            [cliente_id, platillo_nombre, notas || null]
        );
        res.status(201).json(ins.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 4) GET /ordenes/cliente/:id  (listar pedidos de un cliente) */
app.get('/ordenes/cliente/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'id inválido' });
        const q = await pool.query(
            'SELECT id,cliente_id,platillo_nombre,notas,estado,creado FROM ordenes WHERE cliente_id=$1 ORDER BY creado DESC',
            [id]
        );
        res.json(q.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 5) PUT /ordenes/:id/estado  (avanzar estado: pending -> preparing -> delivered) */
app.put('/ordenes/:id/estado', async (req, res) => {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id);
        if (!id) { client.release(); return res.status(400).json({ error: 'id inválido' }); }
        await client.query('BEGIN');
        const cur = await client.query('SELECT id,estado FROM ordenes WHERE id=$1 FOR UPDATE', [id]);
        if (!cur.rowCount) {
            await client.query('ROLLBACK'); client.release();
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        const nuevo = nextEstado(cur.rows[0].estado);
        const upd = await client.query(
            'UPDATE ordenes SET estado=$1 WHERE id=$2 RETURNING id,cliente_id,platillo_nombre,notas,estado,creado',
            [nuevo, id]
        );
        await client.query('COMMIT');
        res.json(upd.rows[0]);
    } catch (e) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

/* ========== FRONTEND ESTÁTICO (misma URL) ========== */
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[API] listening on ${PORT}`));
