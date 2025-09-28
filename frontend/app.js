// API y frontend comparten dominio (Express sirve ambos)
const API_BASE = '';

const $ = (id) => document.getElementById(id);
const state = { cliente: null };

function saveCliente(c) { state.cliente = c; localStorage.setItem('cliente', JSON.stringify(c)); }
function loadCliente() { const raw = localStorage.getItem('cliente'); if (raw) state.cliente = JSON.parse(raw); }
function uiAuth(show) { $('auth').classList.toggle('hidden', !show); $('app').classList.toggle('hidden', show); }

async function api(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) {
        let msg = 'Error';
        try { const j = await res.json(); msg = j.error || JSON.stringify(j); } catch { }
        throw new Error(msg);
    }
    return res.json();
}

async function refreshOrdenes() {
    const cont = $('ordenes');
    cont.innerHTML = '';
    $('listMsg').textContent = 'Cargando...';
    try {
        const data = await api(`/ordenes/cliente/${state.cliente.id}`);
        if (data.length === 0) { $('listMsg').textContent = 'No hay órdenes.'; return; }
        $('listMsg').textContent = '';
        data.forEach(o => {
            const div = document.createElement('div');
            div.className = 'orden';
            div.innerHTML = `
        <div>
          <strong>${o.platillo_nombre}</strong><br/>
          <small>${o.notas || ''}</small>
        </div>
        <div>
          <span class="pill">${o.estado}</span>
          <button data-id="${o.id}" ${o.estado === 'delivered' ? 'disabled' : ''}>Avanzar</button>
        </div>`;
            cont.appendChild(div);
        });
        cont.querySelectorAll('button[data-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                e.target.disabled = true;
                try { await api(`/ordenes/${id}/estado`, { method: 'PUT' }); await refreshOrdenes(); }
                catch (err) { alert(err.message); e.target.disabled = false; }
            });
        });
    } catch (err) { $('listMsg').textContent = err.message; }
}

/* Registro */
$('formReg').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('regMsg').textContent = 'Procesando...';
    try {
        const body = { nombre: $('regNombre').value.trim(), email: $('regEmail').value.trim(), telefono: $('regTel').value.trim() };
        await api('/clientes/registrar', { method: 'POST', body: JSON.stringify(body) });
        $('regMsg').textContent = 'Registro OK. Ahora inicia sesión.';
    } catch (err) { $('regMsg').textContent = err.message; }
});

/* Login */
$('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('logMsg').textContent = 'Procesando...';
    try {
        const body = { email: $('logEmail').value.trim(), telefono: $('logTel').value.trim() };
        const c = await api('/clientes/login', { method: 'POST', body: JSON.stringify(body) });
        saveCliente(c);
        $('cliNombre').textContent = c.nombre; $('cliEmail').textContent = c.email; $('cliTel').textContent = c.telefono; $('cliId').textContent = c.id;
        uiAuth(false); await refreshOrdenes();
    } catch (err) { $('logMsg').textContent = err.message; }
});

/* Crear orden */
$('formOrden').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('ordMsg').textContent = 'Creando...';
    try {
        const body = { cliente_id: state.cliente.id, platillo_nombre: $('ordPlatillo').value.trim(), notas: $('ordNotas').value.trim() };
        await api('/ordenes', { method: 'POST', body: JSON.stringify(body) });
        $('ordPlatillo').value = ''; $('ordNotas').value = ''; $('ordMsg').textContent = 'Orden creada.'; await refreshOrdenes();
    } catch (err) { $('ordMsg').textContent = err.message; }
});

/* Logout */
$('btnLogout').addEventListener('click', () => { localStorage.removeItem('cliente'); state.cliente = null; uiAuth(true); });

(function init() {
    loadCliente();
    if (state.cliente) {
        $('cliNombre').textContent = state.cliente.nombre; $('cliEmail').textContent = state.cliente.email; $('cliTel').textContent = state.cliente.telefono; $('cliId').textContent = state.cliente.id;
        uiAuth(false); refreshOrdenes();
    } else {
        uiAuth(true);
    }
})();
