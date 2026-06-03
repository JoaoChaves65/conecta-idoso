import { initContraste } from './contrast.js';
import { initPageHandlers } from './ui.js';

const PAGES = ['home', 'direitos', 'digital', 'assistiva', 'servicos', 'ajuda', 'voluntarios', 'emergencia'];

let menuAberto = false;

function getDrawer() {
  return document.getElementById('nav-drawer');
}

function getOverlay() {
  return document.getElementById('nav-overlay');
}

function getToggle() {
  return document.getElementById('nav-toggle');
}

export function fecharMenuMobile() {
  if (!menuAberto) return;
  menuAberto = false;
  getDrawer()?.classList.remove('aberto');
  getOverlay()?.classList.remove('visivel');
  getToggle()?.classList.remove('aberto');
  getToggle()?.setAttribute('aria-expanded', 'false');
  getDrawer()?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function abrirMenuMobile() {
  menuAberto = true;
  getDrawer()?.classList.add('aberto');
  getDrawer()?.setAttribute('aria-hidden', 'false');
  getOverlay()?.classList.add('visivel');
  getToggle()?.classList.add('aberto');
  getToggle()?.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function toggleMenuMobile() {
  menuAberto ? fecharMenuMobile() : abrirMenuMobile();
}

function atualizarNav(id) {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('ativo', el.dataset.nav === id);
  });
}

async function carregarPagina(id) {
  const main = document.getElementById('main-content');
  if (!main || !PAGES.includes(id)) return;

  main.innerHTML = '<div class="page-loading">Carregando...</div>';

  try {
    const res = await fetch(`pages/${id}.html`);
    if (!res.ok) throw new Error('Página não encontrada');
    main.innerHTML = await res.text();
  } catch {
    main.innerHTML = '<div class="page-loading">Erro ao carregar a página. Tente novamente.</div>';
    return;
  }

  initPageHandlers();
}

export async function ir(id) {
  if (!PAGES.includes(id)) return;

  await carregarPagina(id);
  atualizarNav(id);
  fecharMenuMobile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState({ page: id }, '', `#${id}`);
}

function initNav() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      ir(el.dataset.nav);
    });
  });

  document.getElementById('logo-btn')?.addEventListener('click', () => ir('home'));
  document.getElementById('nav-toggle')?.addEventListener('click', toggleMenuMobile);
  document.getElementById('nav-overlay')?.addEventListener('click', fecharMenuMobile);
  document.getElementById('btn-emergencia-mobile')?.addEventListener('click', () => ir('emergencia'));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fecharMenuMobile();
  });

  window.addEventListener('popstate', e => {
    const id = e.state?.page || location.hash.slice(1) || 'home';
    if (PAGES.includes(id)) {
      carregarPagina(id).then(() => atualizarNav(id));
    }
  });
}

function paginaInicial() {
  const hash = location.hash.slice(1);
  return PAGES.includes(hash) ? hash : 'home';
}

export function initApp() {
  initContraste();
  initNav();
  ir(paginaInicial());
}

window.ir = ir;

initApp();
