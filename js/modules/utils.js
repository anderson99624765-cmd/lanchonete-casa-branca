// ==========================================================================
// Utilitários Gerais - Formatação, Máscaras, Sanitização e Áudio
// ==========================================================================

/**
 * Formata um valor numérico para Moeda Brasileira (R$ 0,00)
 * @param {number|string} valor 
 * @returns {string}
 */
export function formatarMoeda(valor) {
  const num = parseFloat(valor) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Sanitiza texto simples contra ataques XSS
 * @param {string} str 
 * @returns {string}
 */
export function sanitizarTexto(str) {
  if (typeof str !== 'string') return '';
  // Escapa também aspas, para uso seguro dentro de atributos HTML (alt="...", value="...")
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Limpa números de telefone removendo pontuações
 * @param {string} tel 
 * @returns {string}
 */
export function limparTelefone(tel) {
  return (tel || '').toString().replace(/\D/g, '');
}

/**
 * Aplica máscara de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * @param {string} valor 
 * @returns {string}
 */
export function mascaraTelefone(valor) {
  let v = limparTelefone(valor).slice(0, 11);
  if (v.length > 10) {
    return v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (v.length > 5) {
    return v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
  } else if (v.length > 2) {
    return v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
  } else if (v.length > 0) {
    return v.replace(/^(\d{0,2})$/, '($1');
  }
  return '';
}

/**
 * Aplica as variáveis CSS globais baseadas no objeto de cores
 * @param {Object} cores 
 */
export function aplicarCoresCss(cores) {
  if (!cores) return;
  const root = document.documentElement;
  if (cores.primary) root.style.setProperty('--primary', cores.primary);
  if (cores.primaryDark) root.style.setProperty('--primary-dark', cores.primaryDark);
  if (cores.bgCream) root.style.setProperty('--bg-cream', cores.bgCream);
  if (cores.cardCream) root.style.setProperty('--card-cream', cores.cardCream);
  if (cores.greenOpen) root.style.setProperty('--green-open', cores.greenOpen);
  if (cores.yellowGold) root.style.setProperty('--yellow-gold', cores.yellowGold);
  if (cores.orangeTerra) root.style.setProperty('--orange-terra', cores.orangeTerra);
  if (cores.textLight) root.style.setProperty('--text-light', cores.textLight);
}

/**
 * Notificação visual moderna e acessível (Toast)
 * @param {string} mensagem 
 * @param {'sucesso'|'erro'|'info'|'alerta'} tipo 
 * @param {number} duracaoMs 
 */
export function mostrarToast(mensagem, tipo = 'info', duracaoMs = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo} toast-anim-in`;
  toast.role = 'alert';
  toast.innerHTML = `
    <span class="toast-icone">
      ${tipo === 'sucesso' ? '✓' : tipo === 'erro' ? '✕' : tipo === 'alerta' ? '⚠' : 'ℹ'}
    </span>
    <span class="toast-texto">${sanitizarTexto(mensagem)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('toast-anim-in');
    toast.classList.add('toast-anim-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duracaoMs);
}

/**
 * Emite som sintético de alerta (usado no admin para novos pedidos via Web Audio API)
 */
export function tocarAlertaSonoro() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.24); // D6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn('Não foi possível reproduzir som de alerta:', e);
  }
}
