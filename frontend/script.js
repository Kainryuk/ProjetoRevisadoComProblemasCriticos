const API_USER = 'http://localhost:8080/api';
const API_POST = 'http://localhost:8081/api';

let token = null;
let currentUser = null;
let usersCache = {};
let deptsCache = {};

function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) {
        document.getElementById('login-error').textContent = 'Preencha usuário e senha';
        return;
    }
    try {
        const res = await fetch(`${API_USER}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const err = await res.json();
            document.getElementById('login-error').textContent = err.error || 'Credenciais inválidas';
            return;
        }
        const data = await res.json();
        token = data.token;
        currentUser = data.user;

        document.getElementById('nav-username').textContent = currentUser.username;
        const roleEl = document.getElementById('nav-role');
        roleEl.textContent = currentUser.role;
        roleEl.className = `badge ${currentUser.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}`;
        document.getElementById('nav-dept').textContent = currentUser.departmentName || `Depto #${currentUser.departmentId}`;

        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        await loadCaches();
        loadPosts();
    } catch {
        document.getElementById('login-error').textContent = 'Erro de conexão com o servidor';
    }
}

function logout() {
    token = null; currentUser = null; usersCache = {}; deptsCache = {};
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').textContent = '';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('password').addEventListener('keydown', e => {
        if (e.key === 'Enter') login();
    });
});

async function loadCaches() {
    try {
        const dRes = await fetch(`${API_USER}/departamentos`, { headers: authHeaders() });
        if (dRes.ok) {
            const depts = await dRes.json();
            deptsCache = {};
            depts.forEach(d => { deptsCache[d.id] = d.name; });
        }
    } catch {}
    try {
        const uRes = await fetch(`${API_USER}/usuarios`, { headers: authHeaders() });
        if (uRes.ok) {
            const users = await uRes.json();
            usersCache = {};
            users.forEach(u => { usersCache[u.id] = u.username; });
        }
    } catch {}
}

function userName(userId) { return usersCache[userId] || `user#${userId}`; }
function deptName(deptId) { return deptsCache[deptId] || `Depto #${deptId}`; }

async function loadPosts() {
    try {
        const res = await fetch(`${API_POST}/posts`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Falha ao carregar posts');
        const posts = await res.json();
        renderPosts(posts);
    } catch (err) {
        document.getElementById('posts-list').innerHTML =
            `<p class="error-msg">Erro ao carregar posts: ${err.message}</p>`;
    }
}

function renderPosts(posts) {
    const container = document.getElementById('posts-list');
    if (posts.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhum post encontrado.</p>';
        return;
    }
    container.innerHTML = '';
    for (const post of posts) {
        const div = document.createElement('div');
        div.className = `post${!post.visible ? ' hidden-post' : ''}`;
        div.innerHTML = `
            <div class="post-meta">
                <span class="post-author">${sanitize(userName(post.userId))}</span>
                <span class="post-dept">${sanitize(deptName(post.departmentId))}</span>
                ${!post.visible ? '<span class="post-hidden-badge">🔒 Oculto</span>' : ''}
                <span class="post-date">${formatDate(post.createdAt)}</span>
            </div>
            <div class="post-content">${sanitize(post.content)}</div>
            <div class="post-actions">
                <button class="btn btn-ghost btn-sm" onclick="editPost(${post.id}, \`${sanitize(post.content).replace(/`/g, '\\`')}\`)">✏️ Editar</button>
                <button class="btn btn-warn btn-sm" onclick="toggleVisibility(${post.id}, ${!post.visible})">${post.visible ? '🙈 Ocultar' : '👁️ Mostrar'}</button>
                <button class="btn btn-danger btn-sm" onclick="deletePost(${post.id})">🗑️ Excluir</button>
            </div>
        `;
        container.appendChild(div);
    }
}

async function createPost() {
    const content = document.getElementById('post-content').value.trim();
    if (!content) return;
    await fetch(`${API_POST}/posts`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ content })
    });
    document.getElementById('post-content').value = '';
    loadPosts();
}

async function editPost(id, oldContent) {
    const newContent = prompt('Editar conteúdo do post:', oldContent);
    if (!newContent || newContent === oldContent) return;
    await fetch(`${API_POST}/posts/${id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ content: newContent })
    });
    loadPosts();
}

async function toggleVisibility(id, visible) {
    await fetch(`${API_POST}/posts/${id}/visibility`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ visible })
    });
    loadPosts();
}

async function deletePost(id) {
    if (!confirm('Excluir permanentemente?')) return;
    await fetch(`${API_POST}/posts/${id}`, { method: 'DELETE', headers: authHeaders() });
    loadPosts();
}
