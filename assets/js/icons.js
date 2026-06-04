/**
 * Lucide — mapa de ícones do Conecta Idoso
 * heart-handshake, life-buoy, scale, smartphone, map, watch, users, siren,
 * hospital, pill, building-2, landmark, smile, map-pin, search, phone, mail,
 * globe, ruler, info, ambulance, shield, flame, scroll-text, wallet, bus,
 * home, graduation-cap, church, pill-bottle, volume-2, mic, stethoscope,
 * activity, file-text, clipboard-list, map-pinned, navigation
 */

export function iconHtml(name, classes = 'ci ci--sm') {
  const cls = classes.trim();
  return `<i class="${cls}" data-lucide="${name}" aria-hidden="true"></i>`;
}

export function initIcons() {
  if (typeof window.lucide?.createIcons !== 'function') return;
  try {
    window.lucide.createIcons({ attrs: { 'stroke-width': '2' }, nameAttr: 'data-lucide' });
  } catch {
    /* CDN indisponível — texto permanece legível */
  }
}
