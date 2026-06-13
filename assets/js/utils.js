export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeHtmlDom(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  return d.innerHTML;
}
