import { initIcons } from './icons.js';

export const VIDEOS = [
  {
    id: 'entrevista',
    titulo: 'Entrevista — Vida e desafios na terceira idade',
    descricao: 'Conversas reais sobre o dia a dia, dificuldades e acolhimento dos idosos.',
    arquivo: 'assets/videos/entrevista.mp4',
    destaque: true,
  },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getVideoDestaque() {
  return VIDEOS.find(v => v.destaque) || VIDEOS[0] || null;
}

export function renderPlayer(video, { compact = false } = {}) {
  if (!video) return '';

  const cardClass = compact ? 'video-card video-card--compact' : 'video-card';

  return `
    <article class="${cardClass}" id="video-${escapeHtml(video.id)}">
      <h3 class="video-card-titulo">${escapeHtml(video.titulo)}</h3>
      <p class="video-card-desc">${escapeHtml(video.descricao)}</p>
      <figure class="video-player">
        <video controls preload="metadata" playsinline
               aria-label="${escapeHtml(video.titulo)}">
          <source src="${escapeHtml(video.arquivo)}" type="video/mp4">
          Seu navegador não reproduz vídeo. Tente atualizar ou usar outro aparelho.
        </video>
        <figcaption class="video-legenda">${escapeHtml(video.titulo)}</figcaption>
      </figure>
    </article>
  `;
}

function renderListaVideos() {
  const lista = document.getElementById('videos-lista');
  if (!lista) return;

  if (VIDEOS.length === 0) {
    lista.innerHTML = '<p class="videos-vazio">Nenhum vídeo disponível no momento.</p>';
    return;
  }

  lista.innerHTML = VIDEOS.map(v => renderPlayer(v)).join('');
}

function renderDestaqueHome() {
  const wrap = document.getElementById('video-destaque-home');
  if (!wrap) return;

  const video = getVideoDestaque();
  if (!video) {
    wrap.hidden = true;
    return;
  }

  wrap.innerHTML = renderPlayer(video, { compact: true });
}

export function initVideos() {
  renderListaVideos();
  renderDestaqueHome();
  initIcons();
}
