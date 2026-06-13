import { initIcons } from './icons.js';

const LS_KEY = 'conecta-familiares-v1';
const MSG_WHATSAPP =
  'Preciso de ajuda! Estou em emergência. Por favor, entre em contato comigo.';

let selecionadoId = null;
let editandoId = null;

function gerarId() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function soDigitos(val) {
  return String(val || '').replace(/\D/g, '');
}

export function mascaraTelefone(val) {
  const d = soDigitos(val).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validarTelefoneBR(val) {
  const d = soDigitos(val);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = parseInt(d.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}

export function mascaraExibicao(telefone) {
  const d = soDigitos(telefone);
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d[2]}****-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ****-${d.slice(6)}`;
  }
  return telefone;
}

export function lerFamiliares() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.contatos)) return [];
    return data.contatos.filter(c => c?.id && c?.nome && c?.telefone);
  } catch {
    return [];
  }
}

function gravarFamiliares(contatos) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, contatos }));
  } catch {
    /* quota cheia */
  }
}

export function montarUrlTel(telefone) {
  return `tel:+55${soDigitos(telefone)}`;
}

export function montarUrlWhatsApp(telefone) {
  const num = soDigitos(telefone);
  return `https://wa.me/55${num}?text=${encodeURIComponent(MSG_WHATSAPP)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setFormErro(msg) {
  const el = document.getElementById('fam-form-erro');
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

function atualizarDetailsAberto(contatos) {
  const details = document.getElementById('fam-details');
  if (!details) return;
  if (contatos.length === 0) {
    details.open = true;
  } else if (!editandoId) {
    details.open = false;
  }
}

function renderVazioHint(contatos) {
  const hint = document.getElementById('fam-vazio-hint');
  if (hint) hint.hidden = contatos.length > 0;
}

function renderAcoes(contatos) {
  const wrap = document.getElementById('fam-acoes');
  if (!wrap) return;

  const sel = contatos.find(c => c.id === selecionadoId);
  const desabilitado = !sel;

  wrap.innerHTML = `
    <p class="familiares-hint" id="fam-selecao-hint"${desabilitado ? '' : ' hidden'}>
      Toque no nome do familiar abaixo
    </p>
    <div class="familiares-acoes${desabilitado ? ' familiares-acoes--off' : ''}">
      <a href="${sel ? montarUrlTel(sel.telefone) : '#'}"
         class="btn-familiar-acao btn-familiar-acao--ligar"
         id="fam-btn-ligar"
         ${desabilitado ? 'aria-disabled="true" tabindex="-1"' : ''}>
        <i class="ci ci--sm ci--branco" data-lucide="phone" aria-hidden="true"></i>
        Ligar
      </a>
      <a href="${sel ? montarUrlWhatsApp(sel.telefone) : '#'}"
         class="btn-familiar-acao btn-familiar-acao--whatsapp"
         id="fam-btn-whatsapp"
         target="_blank"
         rel="noopener noreferrer"
         ${desabilitado ? 'aria-disabled="true" tabindex="-1"' : ''}>
        <i class="ci ci--sm ci--branco" data-lucide="message-circle" aria-hidden="true"></i>
        WhatsApp
      </a>
    </div>
  `;

  if (desabilitado) {
    wrap.querySelector('#fam-btn-ligar')?.addEventListener('click', e => e.preventDefault());
    wrap.querySelector('#fam-btn-whatsapp')?.addEventListener('click', e => e.preventDefault());
  }

  initIcons();
}

export function renderListaSelecao() {
  const lista = document.getElementById('fam-lista-selecao');
  if (!lista) return;

  const contatos = lerFamiliares();
  renderVazioHint(contatos);
  atualizarDetailsAberto(contatos);

  if (selecionadoId && !contatos.some(c => c.id === selecionadoId)) {
    selecionadoId = null;
  }

  if (contatos.length === 0) {
    lista.innerHTML = '';
    lista.setAttribute('aria-hidden', 'true');
    renderAcoes(contatos);
    return;
  }

  lista.removeAttribute('aria-hidden');
  lista.innerHTML = contatos
    .map(c => {
      const ativo = c.id === selecionadoId;
      return `
        <button type="button"
                class="familiares-card${ativo ? ' familiares-card--ativo' : ''}"
                data-id="${escapeHtml(c.id)}"
                aria-pressed="${ativo}"
                aria-label="Selecionar ${escapeHtml(c.nome)}">
          <span class="familiares-card-nome">${escapeHtml(c.nome)}</span>
          <span class="familiares-card-tel">${escapeHtml(mascaraExibicao(c.telefone))}</span>
        </button>
      `;
    })
    .join('');

  lista.querySelectorAll('.familiares-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selecionadoId = btn.dataset.id;
      renderListaSelecao();
    });
  });

  renderAcoes(contatos);
  initIcons();
}

function renderListaCadastro() {
  const lista = document.getElementById('fam-lista-cadastro');
  if (!lista) return;

  const contatos = lerFamiliares();

  if (contatos.length === 0) {
    lista.innerHTML = '<p class="familiares-cadastro-vazio">Nenhum familiar cadastrado ainda.</p>';
    initIcons();
    return;
  }

  lista.innerHTML = contatos
    .map(c => `
      <div class="familiares-cadastro-item" data-id="${escapeHtml(c.id)}">
        <div class="familiares-cadastro-info">
          <strong>${escapeHtml(c.nome)}</strong>
          <span>${escapeHtml(mascaraExibicao(c.telefone))}</span>
        </div>
        <div class="familiares-cadastro-btns">
          <button type="button" class="btn-familiar-mini btn-familiar-mini--editar" data-acao="editar" data-id="${escapeHtml(c.id)}" aria-label="Editar ${escapeHtml(c.nome)}">
            <i class="ci ci--xs" data-lucide="pencil" aria-hidden="true"></i> Editar
          </button>
          <button type="button" class="btn-familiar-mini btn-familiar-mini--remover" data-acao="remover" data-id="${escapeHtml(c.id)}" aria-label="Remover ${escapeHtml(c.nome)}">
            <i class="ci ci--xs" data-lucide="trash-2" aria-hidden="true"></i> Remover
          </button>
        </div>
      </div>
    `)
    .join('');

  lista.querySelectorAll('[data-acao="editar"]').forEach(btn => {
    btn.addEventListener('click', () => iniciarEdicao(btn.dataset.id));
  });

  lista.querySelectorAll('[data-acao="remover"]').forEach(btn => {
    btn.addEventListener('click', () => removerContato(btn.dataset.id));
  });

  initIcons();
}

function resetFormulario() {
  editandoId = null;
  const nome = document.getElementById('fam-cad-nome');
  const tel = document.getElementById('fam-cad-tel');
  const btn = document.getElementById('fam-btn-salvar');
  const cancel = document.getElementById('fam-btn-cancelar');
  if (nome) nome.value = '';
  if (tel) tel.value = '';
  if (btn) btn.innerHTML = '<i class="ci ci--sm" data-lucide="user-plus" aria-hidden="true"></i> Adicionar familiar';
  if (cancel) cancel.hidden = true;
  setFormErro('');
  initIcons();
}

function iniciarEdicao(id) {
  const contato = lerFamiliares().find(c => c.id === id);
  if (!contato) return;

  editandoId = id;
  const details = document.getElementById('fam-details');
  if (details) details.open = true;

  const nome = document.getElementById('fam-cad-nome');
  const tel = document.getElementById('fam-cad-tel');
  const btn = document.getElementById('fam-btn-salvar');
  const cancel = document.getElementById('fam-btn-cancelar');
  if (nome) nome.value = contato.nome;
  if (tel) tel.value = mascaraTelefone(contato.telefone);
  if (btn) btn.innerHTML = '<i class="ci ci--sm" data-lucide="pencil" aria-hidden="true"></i> Salvar alterações';
  if (cancel) cancel.hidden = false;
  setFormErro('');
  nome?.focus();
  initIcons();
}

function removerContato(id) {
  const contato = lerFamiliares().find(c => c.id === id);
  if (!contato) return;
  if (!confirm(`Remover ${contato.nome} da lista de familiares?`)) return;

  const restantes = lerFamiliares().filter(c => c.id !== id);
  gravarFamiliares(restantes);
  if (selecionadoId === id) selecionadoId = null;
  if (editandoId === id) resetFormulario();
  renderListaSelecao();
  renderListaCadastro();
}

function salvarContato() {
  const nomeEl = document.getElementById('fam-cad-nome');
  const telEl = document.getElementById('fam-cad-tel');
  const nome = nomeEl?.value.trim() || '';
  const telefone = soDigitos(telEl?.value || '');

  if (nome.length < 2) {
    setFormErro('Digite o nome do familiar (mínimo 2 letras).');
    nomeEl?.focus();
    return;
  }

  if (!validarTelefoneBR(telefone)) {
    setFormErro('Telefone inválido. Use DDD + número: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX.');
    telEl?.focus();
    return;
  }

  const contatos = lerFamiliares();

  if (editandoId) {
    const idx = contatos.findIndex(c => c.id === editandoId);
    if (idx === -1) {
      resetFormulario();
      return;
    }
    contatos[idx] = { ...contatos[idx], nome, telefone };
    gravarFamiliares(contatos);
    resetFormulario();
  } else {
    contatos.push({
      id: gerarId(),
      nome,
      telefone,
      criadoEm: new Date().toISOString(),
    });
    gravarFamiliares(contatos);
    resetFormulario();
  }

  renderListaSelecao();
  renderListaCadastro();
}

function bindFormulario() {
  const telEl = document.getElementById('fam-cad-tel');
  telEl?.addEventListener('input', function () {
    this.value = mascaraTelefone(this.value);
  });

  document.getElementById('fam-form')?.addEventListener('submit', e => {
    e.preventDefault();
    salvarContato();
  });

  document.getElementById('fam-btn-cancelar')?.addEventListener('click', () => {
    resetFormulario();
  });
}

export function initFamiliares() {
  if (!document.getElementById('fam-lista-selecao')) return;

  selecionadoId = null;
  editandoId = null;
  bindFormulario();
  resetFormulario();
  renderListaSelecao();
  renderListaCadastro();
}
