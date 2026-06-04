export function initPageHandlers() {
  if (document.getElementById('servicos-mapa')) return;

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('ativo'));
      this.classList.add('ativo');
    });
  });

  const cepInput = document.getElementById('cep-input');
  if (cepInput) {
    cepInput.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '');
      if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
      this.value = v;
    });
  }
}
