import { iconHtml, initIcons } from './icons.js';
import { escapeHtmlDom as escapeHtml } from './utils.js';

const RAIO_METROS = 5000;
const OVERPASS_TIMEOUT_MS = 28000;
const OVERPASS_INTERVAL_MS = 4000;
const OVERPASS_RETRY_ESPERA_MS = 12000;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const LS_CEP_KEY = 'conecta-servicos-cep';
const LS_CACHE_PREFIX = 'conecta-osm-dia-v2';
const MAPA_PADRAO = { lat: -4.273, lon: -41.778, zoom: 13, label: 'Piripiri, PI' };
const NOMINATIM_HEADERS = {
  'Accept-Language': 'pt-BR',
  'User-Agent': 'ConectaIdoso/1.0 (projeto integrador; contato via GitHub Pages)',
};

const TIPOS = {
  hospital: {
    label: 'Hospital',
    icon: 'hospital',
    filtrar: el =>
      el.amenity === 'hospital' ||
      el.healthcare === 'hospital' ||
      (el.amenity === 'clinic' && nomeContem(el, 'hospital')) ||
      (nomeContem(el, 'hospital') && !nomeContem(el, 'farmácia') && !nomeContem(el, 'farmacia')),
  },
  farmacia: {
    label: 'Farmácia',
    icon: 'pill',
    filtrar: el => el.amenity === 'pharmacy',
  },
  cras: {
    label: 'CRAS',
    icon: 'building-2',
    filtrar: el => nomeContem(el, 'cras') || el.social === 'cras',
  },
  creas: {
    label: 'CREAS',
    icon: 'landmark',
    filtrar: el => nomeContem(el, 'creas') || el.social === 'creas',
  },
  academia: {
    label: 'Academia / Atividade física',
    icon: 'dumbbell',
    filtrar: el =>
      el.leisure === 'fitness_centre' ||
      nomeContem(el, 'academia') ||
      nomeContem(el, 'terceira idade'),
  },
  convivencia: {
    label: 'Centro de convivência',
    icon: 'heart-handshake',
    filtrar: el =>
      el.amenity === 'community_centre' ||
      nomeContem(el, 'convivência') ||
      nomeContem(el, 'convivencia'),
  },
  dentista: {
    label: 'Dentista / Saúde bucal',
    icon: 'smile',
    filtrar: el =>
      el.amenity === 'dentist' ||
      nomeContem(el, 'dent') ||
      nomeContem(el, 'odont') ||
      nomeContem(el, 'odonto'),
  },
};

let mapa = null;
let camadaMarcadores = null;
let marcadorUsuario = null;
let locaisTodos = [];
let cachePorTipo = {};
let coordsAtuais = null;
let enderecoAtual = '';
let tipoAtivo = 'mapa';
let cepAtual = '';
let leafletCarregando = null;
let filaOverpass = Promise.resolve();
let ultimaOverpassMs = 0;

function nomeContem(el, texto) {
  return (el.nome || '').toLowerCase().includes(texto);
}

const ROTULOS_TIPO = {
  hospital: 'Hospital',
  clinic: 'Clínica',
  doctors: 'Consultório médico',
  dentist: 'Consultório odontológico',
  pharmacy: 'Farmácia',
  social_facility: 'Serviço social',
  community_centre: 'Centro comunitário',
  fitness_centre: 'Academia / ginásio',
};

function extrairNome(tags) {
  const bruto = (tags.name || tags['name:pt'] || tags.operator || tags.brand || '').trim();
  if (bruto) return bruto;

  const chave = tags.amenity || tags.healthcare || tags.leisure || '';
  const rotulo = ROTULOS_TIPO[chave];
  if (rotulo) return `${rotulo} (sem nome no mapa)`;
  return 'Local sem nome no mapa';
}

function montarEndereco(tags) {
  const rua = tags['addr:street'] || tags['addr:place'] || tags['addr:road'];
  const num = tags['addr:housenumber'];
  const bairro = tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:quarter'];
  const cidade = tags['addr:city'] || tags['addr:town'] || tags['addr:village'];

  const linha1 = [rua, num].filter(Boolean).join(', ');
  const linha2 = [bairro, cidade].filter(Boolean).join(' — ');
  return [linha1, linha2].filter(Boolean).join(' · ');
}

function extrairContatos(tags) {
  const telefone =
    tags.phone ||
    tags['contact:phone'] ||
    tags.mobile ||
    tags['contact:mobile'] ||
    tags['contact:whatsapp'] ||
    '';
  const email = tags.email || tags['contact:email'] || '';
  let site = tags.website || tags['contact:website'] || tags.url || '';
  if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
  return { telefone: telefone.trim(), email: email.trim(), site: site.trim() };
}

function formatarContatosHtml(contatos) {
  const partes = [];
  if (contatos.telefone) {
    const tel = contatos.telefone.replace(/[^\d+]/g, '');
    partes.push(`${iconHtml('phone', 'ci ci--xs')} <a href="tel:${tel}">${escapeHtml(contatos.telefone)}</a>`);
  }
  if (contatos.email) {
    partes.push(`${iconHtml('mail', 'ci ci--xs')} <a href="mailto:${escapeHtml(contatos.email)}">${escapeHtml(contatos.email)}</a>`);
  }
  if (contatos.site) {
    const label = contatos.site.replace(/^https?:\/\//i, '').slice(0, 40);
    partes.push(`${iconHtml('globe', 'ci ci--xs')} <a href="${escapeHtml(contatos.site)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  }
  if (!partes.length) return '';
  return `<p class="servicos-contato">${partes.join('<br>')}</p>`;
}

function formatarDetalhesLocal(loc) {
  const partes = [];
  if (loc.endereco) partes.push(escapeHtml(loc.endereco));
  else partes.push('<em>Endereço não informado no mapa</em>');

  const c = loc.contatos || {};
  if (c.telefone) {
    const tel = c.telefone.replace(/[^\d+]/g, '');
    partes.push(`${iconHtml('phone', 'ci ci--xs')} <a href="tel:${tel}">${escapeHtml(c.telefone)}</a>`);
  }
  if (c.email) {
    partes.push(`${iconHtml('mail', 'ci ci--xs')} <a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>`);
  }
  if (c.site) {
    const label = c.site.replace(/^https?:\/\//i, '').slice(0, 40);
    partes.push(
      `${iconHtml('globe', 'ci ci--xs')} <a href="${escapeHtml(c.site)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    );
  }
  return partes.join('<br>');
}

function cepLimpo(valor) {
  return valor.replace(/\D/g, '');
}

function mascaraCep(valor) {
  const v = cepLimpo(valor);
  if (v.length <= 5) return v;
  return `${v.slice(0, 5)}-${v.slice(5, 8)}`;
}

function setStatus(msg, tipo = '') {
  const el = document.getElementById('servicos-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'servicos-status' + (tipo ? ` servicos-status--${tipo}` : '');
}

function carregarScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function carregarCss(href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = resolve;
    l.onerror = reject;
    document.head.appendChild(l);
  });
}

async function garantirLeaflet() {
  if (window.L) return;
  if (!leafletCarregando) {
    leafletCarregando = Promise.all([
      carregarCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
      carregarScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'),
    ]);
  }
  await leafletCarregando;
}

export function destroyServicosMap() {
  if (mapa) {
    mapa.remove();
    mapa = null;
    camadaMarcadores = null;
    marcadorUsuario = null;
  }
  locaisTodos = [];
  cachePorTipo = {};
  coordsAtuais = null;
  cepAtual = '';
}

function chaveCacheDiario(cep) {
  const dia = new Date().toISOString().slice(0, 10);
  return `${LS_CACHE_PREFIX}-${cepLimpo(cep)}-${dia}`;
}

function lerCacheDiario(cep) {
  try {
    const raw = localStorage.getItem(chaveCacheDiario(cep));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.dia !== new Date().toISOString().slice(0, 10)) return null;
    return data;
  } catch (err) {
    console.warn('[ConectaIdoso] Cache OSM corrompido:', err);
    return null;
  }
}

function gravarCacheDiarioTipo(cep, tipo, items) {
  try {
    const dia = new Date().toISOString().slice(0, 10);
    const key = chaveCacheDiario(cep);
    const atual = lerCacheDiario(cep) || { dia, tipos: {} };
    atual.tipos[tipo] = items;
    localStorage.setItem(key, JSON.stringify(atual));
  } catch (err) {
    console.warn('[ConectaIdoso] Não foi possível gravar cache OSM (quota?)', err);
  }
}

function carregarCacheDiarioNaMemoria(cep) {
  const cache = lerCacheDiario(cep);
  if (!cache?.tipos) return false;
  cachePorTipo = { ...cache.tipos };
  sincronizarLocaisTodos();
  return Object.keys(cachePorTipo).length > 0;
}

function lerPerfilCep() {
  try {
    const raw = localStorage.getItem(LS_CEP_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.cep || p.lat == null || p.lon == null) return null;
    return p;
  } catch (err) {
    console.warn('[ConectaIdoso] Perfil CEP corrompido:', err);
    return null;
  }
}

function gravarPerfilCep(cep, endereco, lat, lon) {
  try {
    localStorage.setItem(
      LS_CEP_KEY,
      JSON.stringify({
        cep: cepLimpo(cep),
        endereco,
        lat,
        lon,
        salvoEm: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn('[ConectaIdoso] Não foi possível salvar perfil CEP (quota?)', err);
  }
}

function atualizarOverlayMapa() {
  const overlay = document.getElementById('mapa-overlay');
  const texto = document.getElementById('mapa-overlay-cep');
  if (!overlay || !texto) return;
  if (enderecoAtual && cepAtual) {
    texto.textContent = `${mascaraCep(cepAtual)} — ${enderecoAtual}`;
    overlay.setAttribute('aria-hidden', 'false');
  } else {
    overlay.setAttribute('aria-hidden', 'true');
  }
}

async function aguardarVagaOverpass() {
  filaOverpass = filaOverpass.then(async () => {
    const falta = OVERPASS_INTERVAL_MS - (Date.now() - ultimaOverpassMs);
    if (falta > 0) await new Promise(r => setTimeout(r, falta));
    ultimaOverpassMs = Date.now();
  });
  await filaOverpass;
}

function erroRateLimit() {
  return new Error(
    'Servidor de mapas limitou as buscas (muitas requisições seguidas). Aguarde ~15 s e clique no filtro de novo.'
  );
}

function respostaRateLimited(res, data) {
  if (res.status === 429) return true;
  const remark = String(data?.remark || '');
  return remark.includes('rate_limited') || remark.includes('quota');
}

async function buscarViaCep(cep) {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error('Não foi possível consultar o CEP.');
  const data = await res.json();
  if (data.erro) throw new Error('CEP não encontrado. Verifique e tente de novo.');
  return data;
}

async function buscarCoordenadas(endereco) {
  const q = encodeURIComponent(`${endereco.logradouro}, ${endereco.bairro}, ${endereco.localidade}, ${endereco.uf}, Brasil`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error('Não foi possível localizar o endereço no mapa.');
  const data = await res.json();
  if (!data.length) {
    const q2 = encodeURIComponent(`${endereco.localidade}, ${endereco.uf}, Brasil`);
    const res2 = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q2}`,
      { headers: NOMINATIM_HEADERS }
    );
    const data2 = await res2.json();
    if (!data2.length) throw new Error('Cidade não encontrada no mapa.');
    return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon) };
  }
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

function queriesOverpassPorTipo(tipo, lat, lon) {
  const r = RAIO_METROS;
  const porTipo = {
    // Hospitais são prédios (way) — query só de node não acha o Chagas Rodrigues
    hospital: [
      `[out:json][timeout:18];(way["amenity"~"hospital|clinic"](around:${r},${lat},${lon});way["healthcare"="hospital"](around:${r},${lat},${lon}););out center 20;`,
      `[out:json][timeout:15];node["amenity"~"hospital|clinic"](around:${r},${lat},${lon});out body 15;`,
    ],
    farmacia: [`[out:json][timeout:18];node["amenity"="pharmacy"](around:${r},${lat},${lon});out body 40;`],
    dentista: [
      `[out:json][timeout:18];way["amenity"~"dentist|doctors"](around:${r},${lat},${lon});out center 15;`,
      `[out:json][timeout:15];node["amenity"~"dentist|doctors"](around:${r},${lat},${lon});out body 15;`,
    ],
    cras: [`[out:json][timeout:18];(node["name"~"CRAS",i](around:${r},${lat},${lon});node["amenity"="social_facility"](around:${r},${lat},${lon}););out body 25;`],
    creas: [`[out:json][timeout:18];node["name"~"CREAS",i](around:${r},${lat},${lon});out body 25;`],
    academia: [`[out:json][timeout:18];(node["leisure"="fitness_centre"](around:${r},${lat},${lon});node["name"~"Academia|terceira idade",i](around:${r},${lat},${lon}););out body 25;`],
    convivencia: [
      `[out:json][timeout:18];way["amenity"="community_centre"](around:${r},${lat},${lon});out center 15;`,
      `[out:json][timeout:15];node["amenity"="community_centre"](around:${r},${lat},${lon});out body 15;`,
    ],
  };
  return porTipo[tipo] || porTipo.hospital;
}

async function postOverpass(query, tentativa = 0) {
  await aguardarVagaOverpass();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: ctrl.signal,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (respostaRateLimited(res, data)) {
      if (tentativa < 1) {
        setStatus('Servidor ocupado… aguardando 12 segundos para tentar de novo.');
        await new Promise(r => setTimeout(r, OVERPASS_RETRY_ESPERA_MS));
        return postOverpass(query, tentativa + 1);
      }
      throw erroRateLimit();
    }

    if (res.status === 504 || res.status === 502) {
      throw new Error('Servidor de mapas demorou demais. Tente de novo em 1 minuto.');
    }
    if (!res.ok) {
      throw new Error('Serviço de mapas indisponível. Tente em alguns minutos.');
    }

    if (data?.remark) {
      const msg = String(data.remark).toLowerCase();
      if (msg.includes('timed out') || msg.includes('runtime error')) {
        throw new Error('Servidor de mapas demorou demais. Tente de novo em 1 minuto.');
      }
    }
    return normalizarElementos(data?.elements || []);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('A busca demorou demais. O servidor público pode estar lento — tente de novo.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function sincronizarLocaisTodos() {
  locaisTodos = Object.values(cachePorTipo).flat();
}

async function buscarTipoOsm(lat, lon, tipo, cep = cepAtual) {
  if (cachePorTipo[tipo]) return cachePorTipo[tipo];

  if (cep) {
    const cacheDia = lerCacheDiario(cep);
    if (cacheDia?.tipos?.[tipo]) {
      cachePorTipo[tipo] = cacheDia.tipos[tipo];
      sincronizarLocaisTodos();
      return cacheDia.tipos[tipo];
    }
  }

  const queries = queriesOverpassPorTipo(tipo, lat, lon);
  let brutos = [];

  for (const query of queries) {
    try {
      brutos.push(...(await postOverpass(query)));
    } catch (err) {
      if (brutos.length) break;
      throw err;
    }
    // Hospitais: se achou prédios (way), não precisa da 2ª busca de nodes
    if (tipo === 'hospital' && brutos.length > 0) break;
  }

  const vistos = new Set();
  brutos = brutos.filter(item => {
    if (vistos.has(item.id)) return false;
    vistos.add(item.id);
    return true;
  });

  const cfg = TIPOS[tipo];
  const filtrados = cfg ? brutos.filter(cfg.filtrar) : brutos;

  cachePorTipo[tipo] = filtrados;
  if (cep) gravarCacheDiarioTipo(cep, tipo, filtrados);
  sincronizarLocaisTodos();
  return filtrados;
}

const TIPOS_PREFETCH = ['farmacia', 'dentista', 'cras', 'creas', 'academia', 'convivencia'];

function prefetchEmSegundoPlano(lat, lon, cep, tipoInicial) {
  (async () => {
    for (const tipo of TIPOS_PREFETCH) {
      if (tipo === tipoInicial || cachePorTipo[tipo] || lerCacheDiario(cep)?.tipos?.[tipo]) continue;
      try {
        await buscarTipoOsm(lat, lon, tipo, cep);
      } catch (err) {
        console.warn('[ConectaIdoso] Prefetch interrompido:', err.message);
        break;
      }
    }
  })();
}

async function restaurarPagina() {
  await garantirLeaflet();

  const perfil = lerPerfilCep();
  if (perfil) {
    const input = document.getElementById('cep-input');
    if (input) input.value = mascaraCep(perfil.cep);
    cepAtual = perfil.cep;
    enderecoAtual = perfil.endereco;
    coordsAtuais = { lat: perfil.lat, lon: perfil.lon };
    const temCache = carregarCacheDiarioNaMemoria(perfil.cep);
    garantirMapa(perfil.lat, perfil.lon, 14);
    marcarRegiaoCep(perfil.lat, perfil.lon);
    tipoAtivo = 'mapa';
    ativarChip('mapa');
    if (temCache) {
      statusComCache(
        `Bem-vindo de volta! CEP ${mascaraCep(perfil.cep)} — ${perfil.endereco}. Dados de hoje já carregados.`,
        true
      );
    } else {
      statusComCache(
        `CEP ${mascaraCep(perfil.cep)} salvo (${perfil.endereco}). Clique em Buscar para atualizar os locais de hoje.`,
        false
      );
    }
    atualizarExibicao();
    initIcons();
    return;
  }

  garantirMapa(MAPA_PADRAO.lat, MAPA_PADRAO.lon, MAPA_PADRAO.zoom);
  setStatus(`Mapa aberto em ${MAPA_PADRAO.label}. Digite seu CEP e clique em Buscar.`);
  tipoAtivo = 'mapa';
  ativarChip('mapa');
  initIcons();
}

function normalizarElementos(elements) {
  const vistos = new Set();
  const lista = [];

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;

    const tags = el.tags || {};
    const contatos = extrairContatos(tags);

    const item = {
      id: `${el.type}-${el.id}`,
      nome: extrairNome(tags),
      lat,
      lon,
      amenity: tags.amenity || '',
      healthcare: tags.healthcare || '',
      leisure: tags.leisure || '',
      social: tags['social_facility:for'] || tags.social_facility || '',
      endereco: montarEndereco(tags),
      contatos,
    };

    const chave = `${item.nome}-${item.lat.toFixed(4)}-${item.lon.toFixed(4)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(item);
  }

  return lista;
}

function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filtrarPorTipo(tipo) {
  const cfg = TIPOS[tipo];
  if (!cfg) return [];
  const fonte = cachePorTipo[tipo] ?? locaisTodos.filter(cfg.filtrar);
  return fonte
    .map(loc => ({
      ...loc,
      tipo,
      distancia: coordsAtuais
        ? distanciaKm(coordsAtuais.lat, coordsAtuais.lon, loc.lat, loc.lon)
        : 0,
    }))
    .sort((a, b) => a.distancia - b.distancia);
}

function limparCamadaUsuario() {
  if (marcadorUsuario) {
    mapa?.removeLayer(marcadorUsuario);
    marcadorUsuario = null;
  }
}

function limparRaioBusca() {
  if (mapa?._circuloBusca) {
    mapa.removeLayer(mapa._circuloBusca);
    mapa._circuloBusca = null;
  }
}

function iconeMarcadorUsuario() {
  return L.divIcon({
    className: 'marcador-usuario-leaflet',
    html: '<div class="marcador-usuario" aria-hidden="true"><span class="marcador-usuario-ponto"></span></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  });
}

function garantirMapa(lat, lon, zoom = 14) {
  const container = document.getElementById('servicos-mapa');
  if (!container || !window.L) return;

  if (!mapa) {
    mapa = L.map(container, { scrollWheelZoom: true }).setView([lat, lon], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa);
    camadaMarcadores = L.layerGroup().addTo(mapa);
    setTimeout(() => mapa.invalidateSize(), 150);
  } else {
    mapa.setView([lat, lon], zoom);
  }
}

function marcarRegiaoCep(lat, lon) {
  if (!mapa) return;
  limparRaioBusca();
  limparCamadaUsuario();

  mapa._circuloBusca = L.circle([lat, lon], {
    radius: RAIO_METROS,
    color: '#1565C0',
    fillColor: '#2196F3',
    fillOpacity: 0.12,
    weight: 2,
  }).addTo(mapa);

  marcadorUsuario = L.marker([lat, lon], {
    title: 'Sua região (CEP)',
    icon: iconeMarcadorUsuario(),
    zIndexOffset: 1000,
  })
    .addTo(mapa)
    .bindPopup(`<strong>${iconHtml('map-pin', 'ci ci--xs')} Você está aqui</strong><br>Busca em raio de ${RAIO_METROS / 1000} km`)
    .on('popupopen', () => initIcons());

  atualizarOverlayMapa();
}

function mostrarMapa(lat, lon) {
  garantirMapa(lat, lon, 14);
  marcarRegiaoCep(lat, lon);
}

function renderizarMarcadores(locais) {
  if (!mapa || !camadaMarcadores) return;
  camadaMarcadores.clearLayers();

  const cfg = TIPOS[tipoAtivo];
  locais.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lon]);
    const distTexto =
      loc.distancia < 1
        ? `${Math.round(loc.distancia * 1000)} m`
        : `${loc.distancia.toFixed(1)} km`;
    marker.bindPopup(
      `<strong>${iconHtml(cfg.icon, 'ci ci--xs')} ${escapeHtml(loc.nome)}</strong><br>${formatarDetalhesLocal(loc)}<br><em>${distTexto} de você</em>`
    );
    marker.addTo(camadaMarcadores);
    marker.on('popupopen', () => initIcons());
  });

  if (locais.length > 0) {
    const bounds = L.latLngBounds(locais.map(l => [l.lat, l.lon]));
    if (coordsAtuais) bounds.extend([coordsAtuais.lat, coordsAtuais.lon]);
    mapa.fitBounds(bounds.pad(0.15));
  }
}

function renderizarLista(locais) {
  const box = document.getElementById('servicos-resultados');
  const lista = document.getElementById('servicos-lista');
  const localEl = document.getElementById('servicos-local');
  if (!box || !lista) return;

  box.hidden = false;
  if (localEl) {
    localEl.textContent = enderecoAtual
      ? `Buscando perto de: ${enderecoAtual} (raio de ${RAIO_METROS / 1000} km do CEP)`
      : '';
  }

  if (!locais.length) {
    lista.innerHTML =
      '<li class="servicos-lista-vazia">Nenhum local deste tipo encontrado nesta região. Tente outro filtro ou amplie a busca em outra cidade.</li>';
    return;
  }

  const cfg = TIPOS[tipoAtivo];
  lista.innerHTML = locais
    .slice(0, 25)
    .map(loc => {
      const dist =
        loc.distancia < 1
          ? `${Math.round(loc.distancia * 1000)} metros`
          : `${loc.distancia.toFixed(1)} km`;
      return `
        <li class="servicos-item" data-tipo="${tipoAtivo}" data-lat="${loc.lat}" data-lon="${loc.lon}" tabindex="0" role="button">
          <h3>${iconHtml(cfg.icon, 'ci ci--sm')}${escapeHtml(loc.nome)}</h3>
          ${loc.endereco ? `<p class="servicos-endereco">${escapeHtml(loc.endereco)}</p>` : '<p class="servicos-endereco servicos-endereco--vazio">Endereço não informado no mapa</p>'}
          ${formatarContatosHtml(loc.contatos || {})}
          <span class="distancia">${iconHtml('ruler', 'ci ci--xs')} ${dist} de distância</span>
        </li>
      `;
    })
    .join('');

  lista.querySelectorAll('.servicos-item').forEach(item => {
    const focar = () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      mapa?.setView([lat, lon], 17);
      camadaMarcadores?.eachLayer(layer => {
        const ll = layer.getLatLng();
        if (Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lon) < 0.0001) {
          layer.openPopup();
        }
      });
    };
    item.addEventListener('click', focar);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focar();
      }
    });
  });
  initIcons();
}

function ativarChip(tipo) {
  document.querySelectorAll('#servicos-chips .chip').forEach(c => {
    c.classList.toggle('ativo', c.dataset.tipo === tipo);
  });
}

function statusComCache(msg, temCache) {
  setStatus(msg, temCache ? 'cache' : '');
}

function atualizarExibicao() {
  if (tipoAtivo === 'mapa') {
    if (camadaMarcadores) camadaMarcadores.clearLayers();
    document.getElementById('servicos-resultados')?.setAttribute('hidden', '');
    if (coordsAtuais) {
      statusComCache(
        `Mapa de ${enderecoAtual}. Escolha um serviço abaixo para ver locais no mapa.`,
        Boolean(lerCacheDiario(cepAtual))
      );
    } else {
      setStatus(`Mapa aberto. Digite seu CEP e clique em Buscar para marcar sua região.`);
    }
    return;
  }

  const locais = filtrarPorTipo(tipoAtivo);
  const cfg = TIPOS[tipoAtivo];
  renderizarMarcadores(locais);
  renderizarLista(locais);

  const doCache = Boolean(lerCacheDiario(cepAtual)?.tipos?.[tipoAtivo]);
  const sufixoCache = doCache ? ' (dados de hoje, salvos no seu aparelho)' : '';
  statusComCache(
    locais.length
      ? `${locais.length} ${cfg.label.toLowerCase()}${locais.length > 1 ? 's' : ''} encontrado${locais.length > 1 ? 's' : ''} perto de você.${sufixoCache}`
      : `Nenhum ${cfg.label.toLowerCase()} encontrado nesta área. Tente outro tipo de serviço.${sufixoCache}`,
    locais.length ? (doCache ? 'cache' : 'ok') : doCache ? 'cache' : ''
  );
}

async function executarBusca() {
  const input = document.getElementById('cep-input');
  const btn = document.getElementById('cep-buscar');
  if (!input) return;

  const cep = cepLimpo(input.value);
  if (cep.length !== 8) {
    setStatus('Digite um CEP válido com 8 números.', 'erro');
    return;
  }

  const btnLabel = btn?.textContent;
  btn?.setAttribute('disabled', 'true');
  if (btn) btn.textContent = '⏳ Buscando…';
  setStatus('Buscando endereço e serviços próximos…');

  try {
    await garantirLeaflet();

    const endereco = await buscarViaCep(cep);
    enderecoAtual = `${endereco.localidade} - ${endereco.uf}${endereco.bairro ? `, ${endereco.bairro}` : ''}`;

    setStatus('Localizando no mapa…');
    coordsAtuais = await buscarCoordenadas(endereco);
    cepAtual = cep;
    gravarPerfilCep(cep, enderecoAtual, coordsAtuais.lat, coordsAtuais.lon);

    const tinhaCache = carregarCacheDiarioNaMemoria(cep);
    mostrarMapa(coordsAtuais.lat, coordsAtuais.lon);
    tipoAtivo = 'mapa';
    ativarChip('mapa');
    atualizarExibicao();

    if (tinhaCache) {
      statusComCache(
        `CEP ${mascaraCep(cep)} salvo. Dados de hoje já estão no aparelho — escolha um serviço abaixo.`,
        true
      );
      prefetchEmSegundoPlano(coordsAtuais.lat, coordsAtuais.lon, cep, null);
      return;
    }

    setStatus('Carregando locais no mapa… (1 busca por dia; depois fica salvo no aparelho)');
    await buscarTipoOsm(coordsAtuais.lat, coordsAtuais.lon, 'hospital', cep);

    tipoAtivo = 'hospital';
    ativarChip('hospital');
    atualizarExibicao();
    prefetchEmSegundoPlano(coordsAtuais.lat, coordsAtuais.lon, cep, 'hospital');
  } catch (err) {
    setStatus(err.message || 'Erro ao buscar. Tente novamente.', 'erro');
    document.getElementById('servicos-resultados')?.setAttribute('hidden', '');
  } finally {
    btn?.removeAttribute('disabled');
    if (btn && btnLabel) btn.textContent = btnLabel;
  }
}

export async function initServicosMap() {
  const mapaEl = document.getElementById('servicos-mapa');
  if (!mapaEl) return;

  const input = document.getElementById('cep-input');
  const btn = document.getElementById('cep-buscar');
  const chips = document.querySelectorAll('#servicos-chips .chip');

  await restaurarPagina();

  if (input) {
    input.addEventListener('input', () => {
      input.value = mascaraCep(input.value);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') executarBusca();
    });
  }

  btn?.addEventListener('click', executarBusca);

  chips.forEach(chip => {
    chip.addEventListener('click', async () => {
      chips.forEach(c => c.classList.remove('ativo'));
      chip.classList.add('ativo');
      tipoAtivo = chip.dataset.tipo || 'mapa';

      if (tipoAtivo === 'mapa') {
        atualizarExibicao();
        return;
      }

      if (!coordsAtuais) {
        setStatus('Digite seu CEP e clique em Buscar antes de escolher um serviço.', 'erro');
        tipoAtivo = 'mapa';
        ativarChip('mapa');
        return;
      }

      if (cachePorTipo[tipoAtivo] || lerCacheDiario(cepAtual)?.tipos?.[tipoAtivo]) {
        if (!cachePorTipo[tipoAtivo]) {
          cachePorTipo[tipoAtivo] = lerCacheDiario(cepAtual).tipos[tipoAtivo];
          sincronizarLocaisTodos();
        }
        atualizarExibicao();
        return;
      }

      chip.setAttribute('disabled', 'true');
      setStatus(`Buscando ${TIPOS[tipoAtivo]?.label.toLowerCase() || 'locais'}… (salva no aparelho por hoje)`);
      try {
        await buscarTipoOsm(coordsAtuais.lat, coordsAtuais.lon, tipoAtivo, cepAtual);
        atualizarExibicao();
      } catch (err) {
        setStatus(err.message || 'Erro ao buscar. Tente novamente.', 'erro');
      } finally {
        chip.removeAttribute('disabled');
      }
    });
  });
}
