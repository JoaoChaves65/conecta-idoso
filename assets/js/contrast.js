import { atualizarFavicon } from './favicon.js';

const STORAGE_KEY = 'conecta-contraste';

function getToggle() {
  return document.getElementById('toggle-contraste');
}

export function aplicarContraste(ativo) {
  document.body.classList.toggle('alto-contraste', ativo);
  const toggle = getToggle();
  if (toggle) toggle.checked = ativo;
  localStorage.setItem(STORAGE_KEY, ativo ? 'alto' : 'normal');
  atualizarFavicon(ativo);
}

export function initContraste() {
  const toggle = getToggle();
  if (!toggle) return;

  toggle.addEventListener('change', () => aplicarContraste(toggle.checked));

  const salvo = localStorage.getItem(STORAGE_KEY);
  aplicarContraste(salvo !== 'normal');
}
