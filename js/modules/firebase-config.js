// ==========================================================================
// Lanchonete Casa Branca - Configuração do Firebase
// ==========================================================================
// Substitua as credenciais abaixo pelas chaves do seu projeto no Firebase Console:
// 1. Acesse https://console.firebase.google.com/
// 2. Crie ou selecione seu projeto.
// 3. Ative o "Realtime Database" e selecione "Iniciar no modo de teste" ou configure as regras.
// 4. Ative o "Authentication" com o provedor "E-mail/senha".
// 5. Crie um aplicativo web e copie as credenciais do objeto firebaseConfig para cá.
// ==========================================================================

export const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto-casa-branca.firebaseapp.com",
  databaseURL: "https://seu-projeto-casa-branca-default-rtdb.firebaseio.com",
  projectId: "seu-projeto-casa-branca",
  storageBucket: "seu-projeto-casa-branca.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// Configurações padrão da lanchonete (usadas caso o banco ainda não tenha sido iniciado)
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
  modoDestaque: "promocoes", // "promocoes" ou "destaques"
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
