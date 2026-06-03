const STORAGE_KEY = 'conecta-fonte';

function getBotoes() {
  return document.querySelectorAll('[data-fonte-toggle]');
}

export function aplicarFonteMaior(ativo) {
  document.body.classList.toggle('letras-maiores', ativo);
  getBotoes().forEach(btn => {
    btn.classList.toggle('ativo', ativo);
    btn.setAttribute('aria-pressed', String(ativo));
  });
  localStorage.setItem(STORAGE_KEY, ativo ? 'grande' : 'normal');
}

export function initFonte() {
  getBotoes().forEach(btn => {
    btn.addEventListener('click', () => {
      aplicarFonteMaior(!document.body.classList.contains('letras-maiores'));
    });
  });

  const salvo = localStorage.getItem(STORAGE_KEY);
  aplicarFonteMaior(salvo !== 'normal');
}
