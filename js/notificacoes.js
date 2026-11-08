import { formatarMoeda, limparTelefone } from "./modules/utils.js";

export const MODELOS_WHATSAPP_PADRAO = {
  'Recebido': 'Olá, {nome}! 😊 Recebemos o seu pedido #{numero_pedido} na {nome_lanchonete}. Já vamos confirmar e começar o preparo!',
  'Em preparo': 'Olá, {nome}! 👨‍🍳 Seu pedido #{numero_pedido} já está em preparo, feito com muito carinho. Previsão: {previsao}.',
  'Saiu para entrega': 'Olá, {nome}! 🛵 Seu pedido #{numero_pedido} saiu para entrega e já está a caminho de {endereco}. Acompanhe: {link_acompanhamento}',
  'Pronto para retirada': 'Olá, {nome}! ✅ Seu pedido #{numero_pedido} está pronto para retirada na Praça da quadra. Pode vir buscar!',
  'Entregue': 'Olá, {nome}! Pedido #{numero_pedido} entregue. Obrigado pela preferência e bom apetite! ❤️ {nome_lanchonete} – O sabor que faz você se sentir em casa.',
  'Retirado': 'Olá, {nome}! Pedido #{numero_pedido} retirado. Obrigado pela preferência e bom apetite! ❤️ {nome_lanchonete} – O sabor que faz você se sentir em casa.',
  'Cancelado': 'Olá, {nome}. Infelizmente precisamos cancelar o pedido #{numero_pedido}. Motivo: {motivo}. Qualquer dúvida, estamos à disposição.'
};

export const STATUS_WHATSAPP = Object.keys(MODELOS_WHATSAPP_PADRAO);
export const STATUS_WHATSAPP_AUTOMATICOS_PADRAO = [
  'Em preparo',
  'Saiu para entrega',
  'Pronto para retirada',
  'Entregue',
  'Retirado',
  'Cancelado'
];

const VARIAVEIS_WHATSAPP = [
  '{nome}', '{numero_pedido}', '{itens}', '{total}', '{tipo}', '{endereco}',
  '{previsao}', '{link_acompanhamento}', '{nome_lanchonete}', '{motivo}'
];

export function normalizarTelefoneWhatsApp(telefone) {
  let numero = limparTelefone(telefone);
  if (numero.startsWith('00')) numero = numero.slice(2);
  if (numero.startsWith('55')) {
    numero = numero.slice(2);
  } else if (numero.length === 10 || numero.length === 11) {
    // Números nacionais recebem o código do Brasil antes da validação.
  } else {
    return null;
  }

  if (!/^([1-9][0-9])9[0-9]{8}$/.test(numero)) return null;
  return `55${numero}`;
}

function textoSeguro(valor, alternativo = '') {
  return String(valor ?? alternativo).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() || alternativo;
}

export function construirMensagemWhatsApp(pedido, modelo, configuracao = {}) {
  const itens = (pedido.itens || [])
    .map((item) => `${Number(item.quantidade) || 1}x ${textoSeguro(item.nome, 'Item')}`)
    .join(', ') || 'itens do pedido';
  const nome = textoSeguro(pedido.cliente?.nome, 'cliente');
  const variaveis = {
    nome,
    numero_pedido: textoSeguro(pedido.numero, '—'),
    itens,
    total: formatarMoeda(pedido.total),
    tipo: pedido.tipo === 'retirada' ? 'retirada' : 'entrega',
    endereco: textoSeguro(pedido.cliente?.endereco, 'o endereço informado'),
    previsao: textoSeguro(pedido.estimativa, 'em breve'),
    link_acompanhamento: pedido.id
      ? `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}acompanhar.html?pedido=${encodeURIComponent(pedido.id)}`
      : '',
    nome_lanchonete: textoSeguro(configuracao.nome, 'Lanchonete Casa Branca'),
    motivo: textoSeguro(pedido.motivoCancelamento, 'não informado')
  };

  let mensagem = String(modelo || MODELOS_WHATSAPP_PADRAO[pedido.status] || MODELOS_WHATSAPP_PADRAO.Recebido);
  for (const variavel of VARIAVEIS_WHATSAPP) {
    const chave = variavel.slice(1, -1);
    mensagem = mensagem.replaceAll(variavel, variaveis[chave] ?? '');
  }
  return mensagem.replace(/\{[^}]+\}/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function criarLinkWhatsApp(telefone, mensagem) {
  const numero = normalizarTelefoneWhatsApp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

export function obterExemploMensagem(status, modelo) {
  return construirMensagemWhatsApp({
    id: 'pedido-exemplo',
    numero: '1234',
    status,
    tipo: status === 'Pronto para retirada' || status === 'Retirado' ? 'retirada' : 'entrega',
    cliente: { nome: 'João & Maria', endereco: 'Rua das Flores, 120' },
    itens: [{ nome: 'X-Burguer', quantidade: 2 }, { nome: 'Frango', quantidade: 1 }],
    total: 42.5,
    estimativa: '30 a 40 min',
    motivoCancelamento: 'indisponibilidade do produto'
  }, modelo, { nome: 'Lanchonete Casa Branca' });
}
