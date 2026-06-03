const STORAGE_KEY = 'conecta-contraste';

function getToggles() {
  return [
    document.getElementById('toggle-contraste'),
    document.getElementById('toggle-contraste-drawer'),
  ].filter(Boolean);
}

export function aplicarContraste(ativo) {
  document.body.classList.toggle('alto-contraste', ativo);
  getToggles().forEach(toggle => { toggle.checked = ativo; });
  localStorage.setItem(STORAGE_KEY, ativo ? 'alto' : 'normal');
}

export function initContraste() {
  getToggles().forEach(toggle => {
    toggle.addEventListener('change', () => aplicarContraste(toggle.checked));
  });

  const salvo = localStorage.getItem(STORAGE_KEY);
  aplicarContraste(salvo !== 'normal');
}
