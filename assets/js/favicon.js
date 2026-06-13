const FAVICON_NORMAL = 'assets/icons/favicon-normal.svg';
const FAVICON_CONTRAST = 'assets/icons/favicon-contrast.svg';

function getFaviconLink() {
  let link = document.getElementById('favicon-link');
  if (!link) {
    link = document.createElement('link');
    link.id = 'favicon-link';
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }
  return link;
}

export function atualizarFavicon(altoContraste) {
  const link = getFaviconLink();
  link.href = altoContraste ? FAVICON_CONTRAST : FAVICON_NORMAL;

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) {
    theme.content = altoContraste ? '#000000' : '#2E8B57';
  }
}
