import {
  assinarPedidoPublico,
  assinarConfiguracoes,
  atualizarPedidoRecente,
  obterPedidosRecentes
} from "./modules/firebase-service.js";
import { formatarMoeda, limparTelefone, tocarAlertaSonoro } from "./modules/utils.js";
import { normalizarTelefoneWhatsApp } from "./notificacoes.js";

const statusEl = document.getElementById('tracking-state');
const orderSection = document.getElementById('tracking-order');
const recentSection = document.getElementById('tracking-recent-section');
const recentList = document.getElementById('tracking-recent-list');
const query = new URLSearchParams(window.location.search);
const pedidoId = query.get('pedido');
const listeners = [];
let ultimoStatus = null;
let configuracaoPublica = null;
let pedidoAtual = null;

const etapasPorTipo = {
  entrega: [
    { status: 'Recebido', icone: '📥' },
    { status: 'Em preparo', icone: '🍳' },
    { status: 'Saiu para entrega', icone: '🛵' },
    { status: 'Entregue', icone: '✅' }
  ],
  retirada: [
    { status: 'Recebido', icone: '📥' },
    { status: 'Em preparo', icone: '🍳' },
    { status: 'Pronto para retirada', icone: '🛍️' },
    { status: 'Retirado', icone: '✅' }
  ]
};

const mensagensStatus = {
  'Recebido': 'Recebemos seu pedido! Já vamos confirmar.',
  'Em preparo': 'Estamos preparando tudo com carinho.',
  'Saiu para entrega': 'Seu pedido saiu e já está a caminho!',
  'Pronto para retirada': 'Seu pedido está pronto, pode vir buscar!',
  'Entregue': 'Pedido entregue. Bom apetite!',
  'Retirado': 'Pedido retirado. Bom apetite!',
  'Cancelado': 'Este pedido foi cancelado. Fale com a lanchonete se precisar de ajuda.'
};

function mostrarEstado(mensagem) {
  statusEl.textContent = mensagem;
  statusEl.hidden = !mensagem;
}

function formatarData(valor) {
  const data = valor ? new Date(valor) : null;
  return data && !Number.isNaN(data.getTime()) ? data.toLocaleString('pt-BR') : 'Horário não informado';
}

function obterHistorico(pedido) {
  const historico = pedido.historico || {};
  return (Array.isArray(historico) ? historico : Object.values(historico))
    .filter((evento) => evento && evento.status)
    .sort((a, b) => new Date(a.dataHora || 0) - new Date(b.dataHora || 0));
}

function registrarMudanca(status) {
  const mudou = ultimoStatus !== null && ultimoStatus !== status;
  if (mudou) {
    mostrarEstado(`Atualização: ${mensagensStatus[status] || `O status mudou para ${status}.`}`);
    tocarAlertaSonoro();
    if (navigator.vibrate) navigator.vibrate(120);
  }
  ultimoStatus = status;
  return mudou;
}

function atualizarContatoDaLoja() {
  const cabecalho = document.getElementById('tracking-brand-name');
  const botaoWhatsApp = document.getElementById('tracking-whatsapp');
  if (cabecalho) cabecalho.textContent = configuracaoPublica?.nome || 'Dados da loja indisponíveis';
  const telefone = normalizarTelefoneWhatsApp(configuracaoPublica?.whatsapp);
  if (!telefone || !pedidoAtual || !botaoWhatsApp) {
    if (botaoWhatsApp) botaoWhatsApp.hidden = true;
    return;
  }
  const mensagem = encodeURIComponent(`Olá! Preciso de ajuda com o pedido #${pedidoAtual.numero} da ${configuracaoPublica.nome}.`);
  botaoWhatsApp.href = `https://wa.me/${telefone}?text=${mensagem}`;
  botaoWhatsApp.hidden = false;
}

function renderizarTimeline(pedido) {
  const lista = document.getElementById('tracking-timeline');
  const etapas = etapasPorTipo[pedido.tipo] || etapasPorTipo.entrega;
  const status = pedido.status === 'Novo' ? 'Recebido' : pedido.status;
  const indiceAtual = etapas.findIndex((etapa) => etapa.status === status);
  const eventos = obterHistorico(pedido);

  lista.replaceChildren();
  etapas.forEach((etapa, indice) => {
    const item = document.createElement('li');
    item.className = 'tracking-step';
    const finalizado = ['Entregue', 'Retirado'].includes(status);
    const ativo = status !== 'Cancelado' && indiceAtual >= 0;
    // Quando o pedido termina, a última etapa fica verde (concluída) em vez de amarela pulsando.
    const concluida = ativo && (indice < indiceAtual || (finalizado && indice === indiceAtual));
    const atual = ativo && indice === indiceAtual && !finalizado;
    if (concluida) item.classList.add('is-complete');
    if (atual) item.classList.add('is-current');
    item.setAttribute('aria-label', `${etapa.status}${concluida ? ', concluída' : atual ? ', etapa atual' : ', próxima etapa'}`);

    const icone = document.createElement('span');
    icone.className = 'tracking-step-icon';
    icone.setAttribute('aria-hidden', 'true');
    icone.textContent = etapa.icone;

    const conteudo = document.createElement('span');
    conteudo.className = 'tracking-step-copy';
    const titulo = document.createElement('strong');
    titulo.textContent = etapa.status;
    const horario = document.createElement('time');
    const evento = eventos.filter((itemEvento) => itemEvento.status === etapa.status || (etapa.status === 'Recebido' && itemEvento.status === 'Novo')).at(-1);
    horario.textContent = evento ? formatarData(evento.dataHora) : '';
    if (evento?.dataHora) horario.dateTime = evento.dataHora;
    conteudo.append(titulo, horario);
    item.append(icone, conteudo);
    lista.append(item);
  });
}

function renderizarPedido(pedido) {
  if (!pedido) {
    orderSection.hidden = true;
    mostrarEstado('Não encontramos este pedido. Confira o link ou escolha um pedido recente neste aparelho.');
    return;
  }

  const mudouStatus = registrarMudanca(pedido.status);
  pedidoAtual = pedido;
  atualizarContatoDaLoja();
  atualizarPedidoRecente(pedido);
  if (!mudouStatus) mostrarEstado('Pedido atualizado em tempo real.');
  orderSection.hidden = false;
  recentSection.hidden = true;

  document.getElementById('tracking-number').textContent = `#${pedido.numero || '—'}`;
  document.getElementById('tracking-date').textContent = `Recebido em ${formatarData(pedido.criadoEm)}`;
  document.getElementById('tracking-type').textContent = pedido.tipo === 'retirada' ? 'Retirada' : 'Entrega';
  document.getElementById('tracking-announcement').textContent = mensagensStatus[pedido.status === 'Novo' ? 'Recebido' : pedido.status] || mensagensStatus.Recebido;
  document.getElementById('tracking-announcement').classList.toggle('is-cancelled', pedido.status === 'Cancelado');

  const concluido = ['Entregue', 'Retirado'].includes(pedido.status);
  document.getElementById('tracking-announcement').classList.toggle('is-complete', concluido);
  document.getElementById('tracking-estimate').hidden = !pedido.estimativa || concluido || pedido.status === 'Cancelado';
  document.getElementById('tracking-estimate').textContent = pedido.estimativa ? `Previsão: ${pedido.estimativa}` : '';
  document.getElementById('tracking-cancel-reason').hidden = pedido.status !== 'Cancelado' || !pedido.motivoCancelamento;
  document.getElementById('tracking-cancel-reason').textContent = pedido.motivoCancelamento ? `Motivo: ${pedido.motivoCancelamento}` : '';
  document.getElementById('tracking-new-order').hidden = !concluido;

  const itens = document.getElementById('tracking-items');
  itens.replaceChildren();
  (pedido.itens || []).forEach((produto) => {
    const linha = document.createElement('li');
    linha.className = 'tracking-item';
    const nome = document.createElement('span');
    nome.className = 'tracking-item-name';
    nome.textContent = `${produto.quantidade || 1}x ${produto.nome || 'Item'}`;
    const preco = document.createElement('strong');
    preco.textContent = formatarMoeda((Number(produto.precoUnit) || 0) * (Number(produto.quantidade) || 1));
    linha.append(nome, preco);
    itens.append(linha);
  });
  document.getElementById('tracking-total').textContent = formatarMoeda(pedido.total);
  document.getElementById('tracking-payment').textContent = `Pagamento: ${typeof pedido.pagamento === 'string' ? pedido.pagamento : pedido.pagamento?.forma || 'Não informado'}`;
  renderizarTimeline(pedido);
}

function acompanhar(id) {
  mostrarEstado('Carregando pedido...');
  const unsubscribe = assinarPedidoPublico(id, renderizarPedido, (erro) => {
    console.error('Falha ao acompanhar pedido:', erro);
    mostrarEstado(navigator.onLine
      ? 'Não foi possível carregar o pedido. Verifique o link e tente novamente.'
      : 'Sem conexão com a internet. O acompanhamento será retomado quando a conexão voltar.');
  });
  listeners.push(unsubscribe);
}

function renderizarRecentes() {
  recentSection.hidden = false;
  orderSection.hidden = true;
  mostrarEstado('Seus pedidos recentes ficam disponíveis neste aparelho.');
  recentList.replaceChildren();
  const pedidos = obterPedidosRecentes();
  if (!pedidos.length) {
    const vazio = document.createElement('li');
    vazio.textContent = 'Nenhum pedido recente encontrado neste aparelho.';
    recentList.append(vazio);
    return;
  }

  pedidos.forEach((recente) => {
    const linha = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'tracking-recent-link';
    link.href = `acompanhar.html?pedido=${encodeURIComponent(recente.id)}`;
    const identificacao = document.createElement('span');
    identificacao.textContent = `Pedido #${recente.numero || '—'}`;
    const status = document.createElement('span');
    status.textContent = recente.status || 'Consultar status';
    link.append(identificacao, status);
    linha.append(link);
    recentList.append(linha);
    acompanharStatusRecente(recente.id, status);
  });
}

function acompanharStatusRecente(id, elemento) {
  const unsubscribe = assinarPedidoPublico(id, (pedido) => {
    elemento.textContent = pedido?.status || 'Indisponível';
  }, () => {
    elemento.textContent = 'Não foi possível consultar';
  });
  listeners.push(unsubscribe);
}

document.getElementById('tracking-lookup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const numero = document.getElementById('tracking-lookup-number').value.trim();
  const telefone = limparTelefone(document.getElementById('tracking-lookup-phone').value);
  const pedido = obterPedidosRecentes().find((item) => String(item.numero) === numero && item.telefone === telefone);
  const mensagem = document.getElementById('tracking-lookup-message');
  if (!pedido) {
    mensagem.textContent = 'Não encontramos um pedido com esses dados neste aparelho.';
    return;
  }
  window.location.href = `acompanhar.html?pedido=${encodeURIComponent(pedido.id)}`;
});

window.addEventListener('offline', () => {
  document.getElementById('tracking-network').textContent = 'Sem conexão. Acompanhamento pausado até a internet voltar.';
  document.getElementById('tracking-network').hidden = false;
});
window.addEventListener('online', () => {
  document.getElementById('tracking-network').textContent = 'Conexão restabelecida. Atualizando pedido...';
  document.getElementById('tracking-network').hidden = false;
  window.setTimeout(() => { document.getElementById('tracking-network').hidden = true; }, 2500);
});
window.addEventListener('pagehide', () => listeners.forEach((unsubscribe) => unsubscribe()), { once: true });

listeners.push(assinarConfiguracoes((config) => {
  configuracaoPublica = config;
  document.title = `Acompanhar pedido | ${config.nome || ''}`;
  atualizarContatoDaLoja();
}, (erro) => {
  console.error('Falha ao carregar dados da loja para o acompanhamento:', erro);
  mostrarEstado('Não foi possível carregar os dados da loja. Verifique a conexão.');
}));

if (pedidoId) acompanhar(pedidoId);
else renderizarRecentes();
