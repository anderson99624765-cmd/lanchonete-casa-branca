// Configuração única do Firebase e valores usados exclusivamente no seed inicial.
// Substitua todos os marcadores pelas credenciais do mesmo app Web do Firebase.
export const firebaseConfig = {
  apiKey: "AIzaSyDJ-AHX8tL18MWlL8RLtVKm9286oeRyT3s",
  authDomain: "lanchonete-casa-branca.firebaseapp.com",
  databaseURL: "https://lanchonete-casa-branca-default-rtdb.firebaseio.com",
  projectId: "lanchonete-casa-branca",
  storageBucket: "lanchonete-casa-branca.firebasestorage.app",
  messagingSenderId: "173976084313",
  appId: "1:173976084313:web:e56aa144fb780441747648"
};

export const ADMIN_UID = 'kdPgOUtKk7WUghUIoBacvJEaIPg2';
export const ADMIN_UID_CONFIGURADO = Boolean(ADMIN_UID && !ADMIN_UID.startsWith('COLE_'));

const MARCADORES_CONFIG = ['COLE_AQUI', 'COLE_A_URL', 'SEU_PROJETO'];
const URL_REALTIME_DATABASE_VALIDA = /^https:\/\/[a-z0-9.-]+(?:firebasedatabase\.app|firebaseio\.com)$/i.test(firebaseConfig.databaseURL);

export const firebaseConfigValida = URL_REALTIME_DATABASE_VALIDA && Object.values(firebaseConfig).every((valor) =>
  typeof valor === 'string' && valor.length > 0 && !MARCADORES_CONFIG.some((marcador) => valor.includes(marcador))
);

// Os dados abaixo só podem ser gravados no RTDB pelo seed autenticado do admin.
export const CONFIG_PADRAO = {
  nome: "Lanchonete Casa Branca",
  slogan: "O sabor que faz você se sentir em casa.",
  whatsapp: "74999177156",
  whatsappFormatado: "(74) 99917-7156",
  local: "Praça da quadra",
  aberto: true,
  entregaAtiva: true,
  retiradaAtiva: true,
  taxaAtiva: true,
  taxaValor: 3.00,
  minimoEntrega: 10.00,
  modoDestaque: "promocoes",
  statusWhatsappAutomaticos: [
    "Em preparo",
    "Saiu para entrega",
    "Pronto para retirada",
    "Entregue",
    "Retirado",
    "Cancelado"
  ],
  mensagensWhatsapp: {
    Recebido: "Olá, {nome}! 😊 Recebemos o seu pedido #{numero_pedido} na {nome_lanchonete}. Já vamos confirmar e começar o preparo!",
    "Em preparo": "Olá, {nome}! 👨‍🍳 Seu pedido #{numero_pedido} já está em preparo, feito com muito carinho. Previsão: {previsao}.",
    "Saiu para entrega": "Olá, {nome}! 🛵 Seu pedido #{numero_pedido} saiu para entrega e já está a caminho de {endereco}. Acompanhe: {link_acompanhamento}",
    "Pronto para retirada": "Olá, {nome}! ✅ Seu pedido #{numero_pedido} está pronto para retirada na Praça da quadra. Pode vir buscar!",
    Entregue: "Olá, {nome}! Pedido #{numero_pedido} entregue. Obrigado pela preferência e bom apetite! ❤️ {nome_lanchonete} – O sabor que faz você se sentir em casa.",
    Retirado: "Olá, {nome}! Pedido #{numero_pedido} retirado. Obrigado pela preferência e bom apetite! ❤️ {nome_lanchonete} – O sabor que faz você se sentir em casa.",
    Cancelado: "Olá, {nome}. Infelizmente precisamos cancelar o pedido #{numero_pedido}. Motivo: {motivo}. Qualquer dúvida, estamos à disposição."
  },
  cores: {
    primary: "#7A1F12",
    primaryDark: "#5A140B",
    bgCream: "#FFF3DC",
    cardCream: "#F7E3B5",
    greenOpen: "#5E8C3A",
    yellowGold: "#F5C531",
    orangeTerra: "#E87D2F",
    textLight: "#FFFFFF"
  }
};