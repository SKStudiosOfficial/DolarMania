/* =============================
   Configuración
============================= */
const CONFIG = {
  whatsappNumber: '+584122764504',
  whatsappTextGeneral: 'Hola, me interesa su catálogo de DolarMania.',
};

/* === Rutas de JSON por categoría === */
const CATALOG_SOURCES = {
  'Teléfonos':    'data/telefonos.json',
  'Computadoras': 'data/computadoras.json',
  'Accesorios':   'data/accesorios.json',
  'Hogar':        'data/hogar.json',
  'Cosméticos':   'data/cosmeticos.json',
  // agrega más categorías aquí…
};

/* =============================
   Utilidades
============================= */
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtPrice = n => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

function waLink(text = CONFIG.whatsappTextGeneral) {
  const base = 'https://wa.me/';
  const msg  = encodeURIComponent(text);
  const num  = CONFIG.whatsappNumber.replace(/[^\d+]/g, '');
  return `${base}${num}?text=${msg}`;
}

/* =============================
   Render de tarjetas
============================= */
function productCard(p) {
  const img = p.image || 'https://via.placeholder.com/640x480?text=Producto';
  return `
    <article class="card" data-id="${p.id || ''}">
      <div class="card-thumb">
        <img src="${img}" alt="${p.title}" loading="lazy">
      </div>
      <div class="card-body">
        <h3 class="card-title">${p.title}</h3>
        <p class="card-desc">${p.desc || ''}</p>
        <div class="card-price">${fmtPrice(p.price || 0)}</div>
        <div class="card-actions">
          <a class="btn btn-primary"
             href="${waLink(`Hola, me interesa el producto ${p.title}${p.id ? ` (${p.id})` : ''} — Precio: ${fmtPrice(p.price || 0)}`)}"
             target="_blank" rel="noopener">Comprar por WhatsApp</a>
        </div>
      </div>
    </article>
  `;
}

function renderProducts(list) {
  const grid = $('#productGrid');
  if (!list.length) {
    grid.innerHTML = `<p style="opacity:.8">No hay productos para mostrar.</p>`;
    return;
  }
  grid.innerHTML = list.map(productCard).join('');
  attachCardObservers();
}

/* =============================
   Animación (observer)
============================= */
let cardObserver = null;
function ensureCardObserver() {
  if (cardObserver) return cardObserver;
  cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.2 });
  return cardObserver;
}
function attachCardObservers() {
  const obs = ensureCardObserver();
  $$('.card').forEach(c => obs.observe(c));
}

/* =============================
   Carga de datos (fetch + caché)
============================= */
const catalogCache = {}; // { url: arrayProductos }

async function fetchList(url) {
  if (catalogCache[url]) return catalogCache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  const data = await res.json();
  catalogCache[url] = Array.isArray(data) ? data : [];
  return catalogCache[url];
}

/** Normaliza cada item para garantizar campos mínimos */
function normalizeItem(it, fallbackCategory) {
  return {
    id: it.id || '',
    title: it.title || it.name || 'Producto',
    desc: it.desc || it.description || '',
    price: Number(it.price ?? 0),
    image: it.image || it.img || '',
    category: it.category || fallbackCategory || 'Varios',
  };
}

/** Carga una categoría específica */
async function loadCategoryList(cat) {
  const url = CATALOG_SOURCES[cat];
  if (!url) return [];
  const raw = await fetchList(url);
  return raw.map(it => normalizeItem(it, cat));
}

/** Carga “Todos”: 2 de cada categoría */
async function loadAllMixed(limitPerCat = 2) {
  const cats = Object.keys(CATALOG_SOURCES);
  const results = await Promise.all(cats.map(async (c) => {
    const list = await loadCategoryList(c);
    return list.slice(0, limitPerCat);
  }));
  // aplana y opcionalmente ordena (por título)
  return results.flat().sort((a, b) => a.title.localeCompare(b.title, 'es'));
}

/* =============================
   Estado + Filtros + Paginación
============================= */
const state = {
  search: '',
  category: 'Todos',
  page: 1,
  pageSize: 12,
  baseList: [],   // lista base (según categoría seleccionada o “Todos”)
  viewList: [],   // lista filtrada por search
  totalPages: 1,
};

function applySearch() {
  const q = state.search.trim().toLowerCase();
  let out = state.baseList.slice();
  if (q) {
    out = out.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.desc || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q)
    );
  }
  state.viewList = out;
  state.totalPages = Math.max(1, Math.ceil(out.length / state.pageSize));
  // si la página actual se pasa, retrocedemos a la última
  if (state.page > state.totalPages) state.page = state.totalPages;
}

function currentPageItems() {
  const start = (state.page - 1) * state.pageSize;
  const end   = start + state.pageSize;
  return state.viewList.slice(start, end);
}

/* =============================
   Render Paginación
============================= */
function renderPagination() {
  const el = $('#pagination');
  const { page, totalPages } = state;
  if (!el) return;

  // si hay 1 página, ocultamos paginación
  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  const btn = (label, opts = {}) => {
    const { disabled = false, active = false, go } = opts;
    return `<button class="page-btn ${active ? 'is-active' : ''}" ${disabled ? 'disabled' : ''} data-go="${go ?? ''}">${label}</button>`;
  };

  // ventana de páginas visibles (máx 7)
  const windowSize = 7;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end   = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }

  const parts = [];
  parts.push(btn('« Primero', { disabled: page === 1, go: 'first' }));
  parts.push(btn('‹ Anterior', { disabled: page === 1, go: 'prev' }));

  for (let p = start; p <= end; p++) {
    parts.push(btn(String(p), { active: p === page, go: String(p) }));
  }

  parts.push(btn('Siguiente ›', { disabled: page === totalPages, go: 'next' }));
  parts.push(btn('Final »', { disabled: page === totalPages, go: 'last' }));

  el.innerHTML = parts.join('');

  // listeners
  el.querySelectorAll('.page-btn').forEach(b => {
    b.addEventListener('click', () => {
      const go = b.getAttribute('data-go');
      if (!go) return;
      switch (go) {
        case 'first': state.page = 1; break;
        case 'prev':  state.page = Math.max(1, state.page - 1); break;
        case 'next':  state.page = Math.min(state.totalPages, state.page + 1); break;
        case 'last':  state.page = state.totalPages; break;
        default: {
          const n = parseInt(go, 10);
          if (!isNaN(n)) state.page = n;
        }
      }
      renderView();
      scrollToProducts();   // 👈 subir al inicio del grid al cambiar de página
    });
  });
}

/* =============================
   View render (grid + paginación)
============================= */
function renderView() {
  applySearch();
  renderProducts(currentPageItems());
  renderPagination();
}

/* =============================
   Carga según categoría
============================= */
async function setCategory(cat) {
  state.category = cat;
  state.page = 1;

  if (cat === 'Todos') {
    state.baseList = await loadAllMixed(2); // 2 por categoría
  } else {
    state.baseList = await loadCategoryList(cat);
  }

  renderView();
}

/* =============================
   Destacados (opcional)
============================= */
async function renderFeatured() {
  // Si quieres, toma los 4 primeros de “Todos”
  const top = (await loadAllMixed(2)).slice(0, 4);
  $('#featuredGrid').innerHTML = top.map(productCard).join('');
  attachCardObservers();
}

/* =============================
   Eventos
============================= */
document.addEventListener('DOMContentLoaded', async () => {
  // Año footer
  $('#year').textContent = new Date().getFullYear();

  // Enlaces rápidos WhatsApp
  $('#whatsappHero').href    = waLink();
  $('#whatsappCatalog').href = waLink();
  $('#whatsappContact').href = waLink('Hola, quisiera información.');
  $('#whatsappFloat').href   = waLink('¡Hola! Vengo del catálogo.');

  // Buscar
  $('#searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    state.page = 1;
    renderView();
  });

  // Filtros por categoría (usa tus chips existentes con data-cat):contentReference[oaicite:4]{index=4}
  $$('.chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      $$('.chip').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const cat = btn.dataset.cat || 'Todos';
      // Accesibilidad
      $$('.chip').forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      await setCategory(cat);
      // scroll suave al inicio del catálogo
      $('#catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Menú móvil (tal como ya lo tienes):contentReference[oaicite:5]{index=5}
  $('#menuToggle').addEventListener('click', openDrawer);
  $('#menuClose').addEventListener('click', closeDrawer);
  $('#backdrop').addEventListener('click', closeDrawer);
  $$('#mobileNav .drawer-link').forEach(a => a.addEventListener('click', closeDrawer));

  // Formulario contacto
  $('#contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#name').value.trim();
    const phone = $('#phone').value.trim();
    const message = $('#message').value.trim();
    const text = `Hola, soy ${name || 'cliente'}. Tel: ${phone || 'N/D'}.\n${message}`;
    window.open(waLink(text), '_blank');
  });

  // Render inicial
  document.body.classList.add('anim'); // (opcional) para animaciones “fail-safe”
  await renderFeatured();
  await setCategory('Todos');          // carga 2 por categoría
});

/* =============================
   Drawer (como ya lo tenías)
============================= */
function openDrawer() {
  $('#mobileNav').classList.add('is-open');
  $('#backdrop').hidden = false;
  $('#menuToggle').classList.add('is-open');
  $('#menuToggle').setAttribute('aria-expanded', 'true');
  $('#mobileNav').setAttribute('aria-hidden', 'false');
  lockScroll();
}
function closeDrawer() {
  $('#mobileNav').classList.remove('is-open');
  $('#backdrop').hidden = true;
  $('#menuToggle').classList.remove('is-open');
  $('#menuToggle').setAttribute('aria-expanded', 'false');
  $('#mobileNav').setAttribute('aria-hidden', 'true');
  unlockScroll();
}
let __lockScrollY = 0;
function lockScroll() {
  __lockScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${__lockScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}
function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, __lockScrollY);
}

function scrollToProducts() {
  const el = document.getElementById('productGrid') || document.getElementById('catalogo');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


