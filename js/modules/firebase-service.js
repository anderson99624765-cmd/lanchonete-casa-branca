// ==========================================================================
// Serviço do Firebase - RTDB, Auth e Inicialização (Seed)
// Firebase SDK modular v13.2.0; falha explicitamente sem config ou conexão ao RTDB.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  query,
  orderByChild,
  limitToLast,
  set, 
  get, 
  push, 
  update, 
  remove, 
  onValue
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import { ADMIN_UID, ADMIN_UID_CONFIGURADO, firebaseConfig, firebaseConfigValida, CONFIG_PADRAO } from "../firebase.js";

// Inicialização da aplicação Firebase
let app = null;
let db = null;
let auth = null;
let conexaoValida = false;
let firebaseConectado = false;

try {
  if (firebaseConfigValida) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    conexaoValida = true;
    console.info("Firebase SDK inicializado para:", firebaseConfig.projectId, firebaseConfig.databaseURL);
  } else {
    console.error("Firebase não configurado: preencha js/firebase.js. Nenhum dado de negócio será salvo localmente.");
  }
} catch (e) {
  console.error("Erro ao inicializar Firebase SDK:", e);
}

export { 
  app, 
  db, 
  auth, 
  conexaoValida, 
  sendPasswordResetEmail, 
  updatePassword, 
  updateEmail, 
  verifyBeforeUpdateEmail, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
};

const STORAGE_KEY_PEDIDOS_RECENTES = 'casabranca_pedidos_recentes';

function exigirBanco() {
  if (!conexaoValida || !db) {
    const erro = new Error('Firebase não configurado. Preencha js/firebase.js antes de usar o site.');
    erro.code = 'firebase/not-configured';
    throw erro;
  }
  return db;
}

function exigirAdmin() {
  exigirBanco();
  if (!auth?.currentUser) {
    const erro = new Error('É necessário autenticar o administrador no Firebase para gravar estes dados.');
    erro.code = 'auth/not-authenticated';
    throw erro;
  }
  if (!ADMIN_UID_CONFIGURADO || auth.currentUser.uid !== ADMIN_UID) {
    const erro = new Error('Configure o UID do administrador em js/firebase.js e autentique essa conta para gravar dados.');
    erro.code = 'auth/admin-only';
    throw erro;
  }
  return auth.currentUser;
}

function exigirConexaoAtiva() {
  if (!firebaseConectado) {
    const erro = new Error('Sem conexão com o Firebase. Nenhuma alteração foi salva; reconecte e tente novamente.');
    erro.code = 'firebase/disconnected';
    throw erro;
  }
}

function reportarErroFirebase(operacao, caminho, erro, onError) {
  console.error(`Falha Firebase em ${operacao} (${caminho}):`, erro);
  if (typeof onError === 'function') onError(erro);
}

export function assinarConexaoFirebase(callback) {
  if (!conexaoValida || !db) {
    callback(false);
    return () => {};
  }
  return onValue(ref(db, '.info/connected'), (snapshot) => {
    firebaseConectado = snapshot.val() === true;
    callback(firebaseConectado);
  }, (erro) => {
    firebaseConectado = false;
    reportarErroFirebase('observar conexão', '.info/connected', erro);
    callback(false);
  });
}

export function aguardarConexaoFirebase(limiteMs = 12000) {
  if (!conexaoValida || !db) return Promise.reject(new Error('Firebase não configurado.'));
  if (firebaseConectado) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const tempoLimite = setTimeout(() => {
      unsubscribe();
      const erro = new Error('O Firebase não confirmou conexão dentro do tempo limite. Verifique a internet e a URL do Realtime Database.');
      erro.code = 'firebase/connection-timeout';
      reject(erro);
    }, limiteMs);
    unsubscribe = assinarConexaoFirebase((conectado) => {
      if (!conectado) return;
      clearTimeout(tempoLimite);
      unsubscribe();
      resolve();
    });
  });
}

// ==========================================================================
// SEED INICIAL (CATEGORIAS E PRODUTOS PADRÃO)
// ==========================================================================
const SEED_CATEGORIAS_INICIAIS = [
  { id: "cat-salgados", nome: "Salgados", ordem: 1, ativa: true },
  { id: "cat-lanches", nome: "Lanches", ordem: 2, ativa: true },
  { id: "cat-bebidas", nome: "Bebidas", ordem: 3, ativa: true }
];

const SEED_PRODUTOS_INICIAIS = [
  {
    id: "p1",
    nome: "Coxinha de Frango",
    descricao: "Massa crocante por fora e macia por dentro, recheada com frango desfiado temperado artesanalmente.",
    preco: 1.00,
    precoPromo: null,
    categoriaId: "cat-salgados",
    foto: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80",
    obs: "Salsicha, calabresa e presunto são de frango!",
    disponivel: true,
    destaque: true
  },
  {
    id: "p2",
    nome: "Pastel de Carne",
    descricao: "Carne moída suculenta com temperos especiais da casa e massa frita sequinha e dourada.",
    preco: 1.00,
    precoPromo: null,
    categoriaId: "cat-salgados",
    foto: "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600&auto=format&fit=crop&q=80",
    obs: "Salsicha, calabresa e presunto são de frango!",
    disponivel: true,
    destaque: false
  },
  {
    id: "p3",
    nome: "Pastel de Queijo e Presunto",
    descricao: "Recheio cremoso e generoso com muçarela derretida e presunto selecionado.",
    preco: 1.00,
    precoPromo: null,
    categoriaId: "cat-salgados",
    foto: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80",
    obs: "Salsicha, calabresa e presunto são de frango!",
    disponivel: true,
    destaque: true
  },
  {
    id: "p4",
    nome: "Enroladinho de Calabresa",
    descricao: "Deliciosa massa fofinha com recheio saboroso de calabresa fatiada.",
    preco: 1.00,
    precoPromo: null,
    categoriaId: "cat-salgados",
    foto: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80",
    obs: "Salsicha, calabresa e presunto são de frango!",
    disponivel: true,
    destaque: false
  },
  {
    id: "p5",
    nome: "Enroladinho de Salsicha",
    descricao: "O clássico enroladinho crocante com salsicha de frango suculenta.",
    preco: 1.00,
    precoPromo: null,
    categoriaId: "cat-salgados",
    foto: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=600&auto=format&fit=crop&q=80",
    obs: "Salsicha, calabresa e presunto são de frango!",
    disponivel: true,
    destaque: false
  }
];

/**
 * Garante o seed inicial caso não haja dados
 */
export async function verificarEExecutarSeed() {
  exigirAdmin();
  try {
  await aguardarConexaoFirebase();
      const configSnapshot = await get(ref(db, "config"));
      if (!configSnapshot.exists()) {
        await set(ref(db, "config"), { ...CONFIG_PADRAO, __seedDefault: true });
        console.log("Configurações iniciais gravadas no Firebase.");
      }

      const catSnapshot = await get(ref(db, "categorias"));
      let salgadosId = null;

      if (!catSnapshot.exists()) {
        const categoriasRef = ref(db, "categorias");
        const catSalgados = push(categoriasRef);
        salgadosId = catSalgados.key;
        await set(catSalgados, { nome: "Salgados", ordem: 1, ativa: true });

        const catLanches = push(categoriasRef);
        await set(catLanches, { nome: "Lanches", ordem: 2, ativa: true });

        const catBebidas = push(categoriasRef);
        await set(catBebidas, { nome: "Bebidas", ordem: 3, ativa: true });
      } else {
        const cats = catSnapshot.val();
        for (const id in cats) {
          if (cats[id].nome && cats[id].nome.toLowerCase().includes("salgado")) {
            salgadosId = id;
            break;
          }
        }
      }

      const prodSnapshot = await get(ref(db, "produtos"));
      if (!prodSnapshot.exists() && salgadosId) {
        const produtosRef = ref(db, "produtos");
        for (const prod of SEED_PRODUTOS_INICIAIS) {
          const dadosProduto = { ...prod };
          delete dadosProduto.id;
          await push(produtosRef, { ...dadosProduto, categoriaId: salgadosId });
        }
      }
  } catch (err) {
    reportarErroFirebase('seed inicial', '/config, /categorias, /produtos', err);
    throw err;
  }
}

// --------------------------------------------------------------------------
// MÉTODOS DE CONFIGURAÇÃO DO SITE (/config)
// --------------------------------------------------------------------------
export function assinarConfiguracoes(callback, onError) {
  if (!conexaoValida || !db) {
    const erro = new Error('Firebase não configurado. Não foi possível ler /config.');
    reportarErroFirebase('leitura em tempo real', '/config', erro, onError);
    return () => {};
  }
  return onValue(ref(db, 'config'), (snapshot) => {
    if (!snapshot.exists()) {
      const erro = new Error('O nó /config não existe. Entre no admin para executar o seed inicial.');
      reportarErroFirebase('leitura', '/config', erro, onError);
      return;
    }
    callback(snapshot.val());
  }, (erro) => reportarErroFirebase('listener em tempo real', '/config', erro, onError));
}

export async function salvarConfiguracoes(novasConfigs) {
  exigirAdmin();
  exigirConexaoAtiva();
  try {
    await update(ref(db, 'config'), { ...novasConfigs, __seedDefault: false });
    return true;
  } catch (e) {
    reportarErroFirebase('gravação', '/config', e);
    throw e;
  }
}

// --------------------------------------------------------------------------
// MÉTODOS DE CATEGORIAS (/categorias)
// --------------------------------------------------------------------------
export function assinarCategorias(callback, onError) {
  if (!conexaoValida || !db) {
    reportarErroFirebase('leitura em tempo real', '/categorias', new Error('Firebase não configurado.'), onError);
    return () => {};
  }
  return onValue(ref(db, 'categorias'), (snapshot) => {
    const dados = [];
    snapshot.forEach((child) => dados.push({ ...child.val(), id: child.key }));
    dados.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    callback(dados);
  }, (erro) => reportarErroFirebase('listener em tempo real', '/categorias', erro, onError));
}

export async function salvarCategoria(categoria, id = null) {
  exigirAdmin();
  exigirConexaoAtiva();
  try {
    if (id) {
      await update(ref(db, `categorias/${id}`), categoria);
      return id;
    }
    const novo = push(ref(db, 'categorias'));
    await set(novo, categoria);
    return novo.key;
  } catch (e) {
    reportarErroFirebase('gravação', id ? `/categorias/${id}` : '/categorias', e);
    throw e;
  }
}

export async function excluirCategoria(id) {
  exigirAdmin();
  exigirConexaoAtiva();
  try {
    await remove(ref(db, `categorias/${id}`));
  } catch (e) {
    reportarErroFirebase('remoção', `/categorias/${id}`, e);
    throw e;
  }
}

// --------------------------------------------------------------------------
// MÉTODOS DE PRODUTOS (/produtos)
// --------------------------------------------------------------------------
export function assinarProdutos(callback, onError) {
  if (!conexaoValida || !db) {
    reportarErroFirebase('leitura em tempo real', '/produtos', new Error('Firebase não configurado.'), onError);
    return () => {};
  }
  return onValue(ref(db, 'produtos'), (snapshot) => {
    const dados = [];
    snapshot.forEach((child) => {
      const produto = child.val();
      dados.push({ ...produto, id: child.key, ...(produto.id && produto.id !== child.key ? { idLegado: produto.id } : {}) });
    });
    callback(dados);
  }, (erro) => reportarErroFirebase('listener em tempo real', '/produtos', erro, onError));
}

export async function salvarProduto(produto, id = null) {
  exigirAdmin();
  exigirConexaoAtiva();
  try {
    if (id) {
      await update(ref(db, `produtos/${id}`), produto);
      return id;
    }
    const novo = push(ref(db, 'produtos'));
    await set(novo, produto);
    return novo.key;
  } catch (e) {
    reportarErroFirebase('gravação', id ? `/produtos/${id}` : '/produtos', e);
    throw e;
  }
}

export async function excluirProduto(id) {
  exigirAdmin();
  exigirConexaoAtiva();
  try {
    await remove(ref(db, `produtos/${id}`));
  } catch (e) {
    reportarErroFirebase('remoção', `/produtos/${id}`, e);
    throw e;
  }
}

// --------------------------------------------------------------------------
// MÉTODOS DE CLIENTES (/clientes)
// --------------------------------------------------------------------------
export async function buscarClientePorTelefone(telefoneLimpo) {
  if (!telefoneLimpo) return null;
  if (!auth?.currentUser || !ADMIN_UID_CONFIGURADO || auth.currentUser.uid !== ADMIN_UID) return null;
  exigirBanco();
  try {
    const snap = await get(ref(db, `clientes/${telefoneLimpo}`));
    return snap.exists() ? snap.val() : null;
  } catch (erro) {
    reportarErroFirebase('consulta', `/clientes/${telefoneLimpo}`, erro);
    throw erro;
  }
}

export async function salvarCliente(cliente) {
  const telLimpo = (cliente.telefone || "").replace(/\D/g, "");
  if (!telLimpo) throw new Error('Telefone inválido: o cliente não foi salvo.');
  exigirBanco();
  exigirConexaoAtiva();

  const clienteData = {
    ...cliente,
    telefoneLimpo: telLimpo,
    atualizadoEm: new Date().toISOString(),
    atualizadoEmTimestamp: Date.now()
  };

  try {
    await set(ref(db, `clientes/${telLimpo}`), clienteData);
    return true;
  } catch (erro) {
    reportarErroFirebase('gravação', `/clientes/${telLimpo}`, erro);
    throw erro;
  }
}

export function assinarClientes(callback, onError) {
  exigirAdmin();
  if (!conexaoValida || !db) {
    reportarErroFirebase('leitura em tempo real', '/clientes', new Error('Firebase não configurado.'), onError);
    return () => {};
  }
  const consulta = query(ref(db, 'clientes'), orderByChild('atualizadoEmTimestamp'), limitToLast(200));
  return onValue(consulta, (snapshot) => {
    const dados = [];
    snapshot.forEach((child) => dados.push({ id: child.key, ...child.val() }));
    dados.sort((a, b) => (b.atualizadoEmTimestamp || 0) - (a.atualizadoEmTimestamp || 0));
    callback(dados);
  }, (erro) => reportarErroFirebase('listener em tempo real', '/clientes', erro, onError));
}

// --------------------------------------------------------------------------
// MÉTODOS DE PEDIDOS (/pedidos)
// --------------------------------------------------------------------------
export async function criarPedido(pedido) {
  exigirBanco();
  exigirConexaoAtiva();
  const numeroPedido = Math.floor(1000 + Math.random() * 9000);
  const criadoEm = new Date().toISOString();
  const criadoEmTimestamp = Date.now();
  const status = "Recebido";

  try {
    const novoPedidoRef = push(ref(db, "pedidos"));
    const id = novoPedidoRef.key;
    const eventoInicialRef = push(ref(db, `pedidos/${id}/historico`));
    // O nó público usa o ID aleatório como chave e não inclui dados pessoais do cliente.
    const pedidoPublico = {
      numero: numeroPedido,
      status,
      criadoEm,
      criadoEmTimestamp,
      tipo: pedido.tipo,
      itens: (pedido.itens || []).map(({ id, nome, quantidade, precoUnit }) => ({ id, nome, quantidade, precoUnit })),
      subtotal: pedido.subtotal,
      taxa: pedido.taxa,
      total: pedido.total,
      pagamento: pedido.pagamento?.forma || "não informado",
      historico: {
        [eventoInicialRef.key]: { status, dataHora: criadoEm }
      }
    };
    // Dados de contato e observações ficam separados, acessíveis apenas ao administrador.
    const pedidoPrivado = {
      cliente: pedido.cliente,
      itens: pedido.itens || [],
      subtotal: pedido.subtotal,
      taxa: pedido.taxa,
      pagamento: pedido.pagamento,
      observacaoGeral: pedido.observacaoGeral || "",
      criadoEmTimestamp
    };

    await update(ref(db), {
      [`pedidos/${id}`]: pedidoPublico,
      [`pedidosPrivados/${id}`]: pedidoPrivado
    });

    const pedidoCompleto = { id, ...pedidoPublico, ...pedidoPrivado };
    registrarPedidoRecente(pedidoCompleto);
    return pedidoCompleto;
  } catch (erro) {
    reportarErroFirebase('criação do pedido', '/pedidos e /pedidosPrivados', erro);
    throw erro;
  }
}

export function assinarPedidos(callback, onError) {
  exigirAdmin();
  const caminhoPedidos = "/pedidos";
  let dadosPublicos = {};
  let dadosPrivados = {};
  const emitirPedidos = () => {
    const dados = Object.keys(dadosPublicos).map((id) => ({
      id,
      ...dadosPublicos[id],
      ...(dadosPrivados[id] || {})
    }));
    dados.sort((a, b) => (b.criadoEmTimestamp || 0) - (a.criadoEmTimestamp || 0));
    callback(dados);
  };
  const consultaPublicos = query(ref(db, caminhoPedidos), orderByChild('criadoEmTimestamp'), limitToLast(500));
  const consultaPrivados = query(ref(db, 'pedidosPrivados'), orderByChild('criadoEmTimestamp'), limitToLast(500));
  const unsubscribePublicos = onValue(consultaPublicos, (snapshot) => {
    dadosPublicos = snapshot.val() || {};
    emitirPedidos();
  }, (erro) => reportarErroFirebase('listener de pedidos', caminhoPedidos, erro, onError));
  const unsubscribePrivados = onValue(consultaPrivados, (snapshot) => {
    dadosPrivados = snapshot.val() || {};
    emitirPedidos();
  }, (erro) => reportarErroFirebase('listener de dados privados dos pedidos', '/pedidosPrivados', erro, onError));

  return () => {
    unsubscribePublicos();
    unsubscribePrivados();
  };
}

function registrarPedidoRecente(pedido) {
  try {
    const existentes = obterPedidosRecentes();
    const anterior = existentes.find((item) => item.id === pedido.id);
    const recentes = existentes.filter((item) => item.id !== pedido.id);
    recentes.unshift({
      id: pedido.id,
      numero: pedido.numero,
      telefone: String(pedido.cliente?.telefone || anterior?.telefone || "").replace(/\D/g, ""),
      tipo: pedido.tipo,
      status: pedido.status,
      criadoEm: pedido.criadoEm
    });
    localStorage.setItem(STORAGE_KEY_PEDIDOS_RECENTES, JSON.stringify(recentes.slice(0, 10)));
    localStorage.setItem("casabranca_ultimo_pedido_id", pedido.id);
  } catch (e) {
    console.warn("Não foi possível guardar a lista local de pedidos:", e);
  }
}

export function atualizarPedidoRecente(pedido) {
  registrarPedidoRecente(pedido);
}

export function obterPedidosRecentes() {
  try {
    const recentes = JSON.parse(localStorage.getItem(STORAGE_KEY_PEDIDOS_RECENTES) || "[]");
    return Array.isArray(recentes) ? recentes : [];
  } catch (e) {
    return [];
  }
}

export function assinarPedidoPublico(pedidoId, callback, aoFalhar = () => {}) {
  if (!pedidoId || /[.#$/\[\]]/.test(pedidoId)) {
    aoFalhar(new Error("Identificador de pedido inválido."));
    return () => {};
  }

  if (!conexaoValida || !db) {
    const erro = new Error('Firebase não configurado. O acompanhamento online está indisponível.');
    reportarErroFirebase('leitura do pedido', `/pedidos/${pedidoId}`, erro, aoFalhar);
    return () => {};
  }
  return onValue(ref(db, `pedidos/${pedidoId}`), (snapshot) => {
    callback(snapshot.exists() ? { id: pedidoId, ...snapshot.val() } : null);
  }, (erro) => reportarErroFirebase('listener do pedido', `/pedidos/${pedidoId}`, erro, aoFalhar));
}

export async function atualizarStatusPedido(pedidoId, novoStatus, opcoes = {}) {
  exigirAdmin();
  exigirConexaoAtiva();
  const dataHora = new Date().toISOString();
  const evento = { status: novoStatus, dataHora };
  const alteracoes = {
    [`pedidos/${pedidoId}/status`]: novoStatus,
    [`pedidos/${pedidoId}/atualizadoEm`]: dataHora
  };
  if (opcoes.motivoCancelamento) {
    evento.motivo = opcoes.motivoCancelamento;
    alteracoes[`pedidos/${pedidoId}/motivoCancelamento`] = opcoes.motivoCancelamento;
  }
  if (opcoes.estimativa) alteracoes[`pedidos/${pedidoId}/estimativa`] = opcoes.estimativa;

  try {
    const eventoRef = push(ref(db, `pedidos/${pedidoId}/historico`));
    alteracoes[`pedidos/${pedidoId}/historico/${eventoRef.key}`] = evento;
    await update(ref(db), alteracoes);
    return true;
  } catch (erro) {
    reportarErroFirebase('atualização de status', `/pedidos/${pedidoId}`, erro);
    throw erro;
  }
}

export async function salvarEstimativaPedido(pedidoId, estimativa) {
  exigirAdmin();
  exigirConexaoAtiva();
  try {
    await update(ref(db), { [`pedidos/${pedidoId}/estimativa`]: estimativa });
    return true;
  } catch (erro) {
    reportarErroFirebase('gravação de previsão', `/pedidos/${pedidoId}/estimativa`, erro);
    throw erro;
  }
}

export async function registrarNotificacaoPedido(pedidoId, status, enviado) {
  exigirAdmin();
  exigirConexaoAtiva();
  const notificacao = {
    status: String(status || ''),
    dataHora: new Date().toISOString(),
    enviado: Boolean(enviado)
  };

  try {
    const notificacaoRef = push(ref(db, `pedidos/${pedidoId}/notificacoes`));
    await set(notificacaoRef, notificacao);
    return { id: notificacaoRef.key, ...notificacao };
  } catch (erro) {
    reportarErroFirebase('registro de notificação', `/pedidos/${pedidoId}/notificacoes`, erro);
    throw erro;
  }
}

function lerDadosLegados(chave, valorPadrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : valorPadrao;
  } catch (erro) {
    throw new Error(`O dado local "${chave}" não pôde ser lido: ${erro.message}`);
  }
}

function registrosLegados(valor) {
  if (Array.isArray(valor)) return valor.filter((item) => item && typeof item === 'object');
  if (!valor || typeof valor !== 'object') return [];
  return Object.entries(valor).map(([id, registro]) => ({ id, ...registro }));
}

function assinaturaColecao(tipo, registro, mapaCategorias = new Map()) {
  const normalizar = (valor) => String(valor ?? '').trim().toLocaleLowerCase('pt-BR');
  if (tipo === 'categorias') return normalizar(registro.nome);
  if (tipo === 'produtos') {
    const categoria = mapaCategorias.get(registro.categoriaId) || registro.categoriaId;
    return `${normalizar(registro.nome)}|${normalizar(categoria)}`;
  }
  return normalizar(registro.telefoneLimpo || registro.id);
}

function assinaturaPedido(pedidoPublico, pedidoPrivado) {
  const telefone = String(pedidoPrivado?.cliente?.telefone || '').replace(/\D/g, '');
  return `${pedidoPublico?.numero || ''}|${pedidoPublico?.criadoEmTimestamp || ''}|${telefone}`;
}

export async function migrarDadosLocaisParaFirebase() {
  exigirAdmin();
  await aguardarConexaoFirebase();
  const chaveMigracao = 'casabranca_migracao_firebase_v1';
  if (localStorage.getItem(chaveMigracao)) {
    const erro = new Error('A migração deste aparelho já foi concluída.');
    erro.code = 'migration/already-completed';
    throw erro;
  }

  try {
    const localConfig = lerDadosLegados('casabranca_db_config', {});
    const localCategorias = registrosLegados(lerDadosLegados('casabranca_db_categorias', []));
    const localProdutos = registrosLegados(lerDadosLegados('casabranca_db_produtos', []));
    const localClientes = registrosLegados(lerDadosLegados('casabranca_db_clientes', {}));
    const localPedidos = registrosLegados(lerDadosLegados('casabranca_db_pedidos', []));
    const contagem = { configuracoes: 0, categorias: 0, produtos: 0, clientes: 0, pedidos: 0, ignorados: 0 };

    const configSnapshot = await get(ref(db, 'config'));
    const configAtual = configSnapshot.val() || {};
    const configFaltante = {};
    const configSemeadaSemEdicoes = configAtual.__seedDefault === true;
    Object.entries(localConfig).forEach(([chave, valor]) => {
      if (chave === '__seedDefault') return;
      if (configSemeadaSemEdicoes) {
        configFaltante[chave] = valor;
        return;
      }
      if (chave === 'cores' && valor && typeof valor === 'object') {
        const coresFaltantes = Object.fromEntries(Object.entries(valor).filter(([nome]) => configAtual.cores?.[nome] === undefined));
        if (Object.keys(coresFaltantes).length) configFaltante.cores = { ...configFaltante.cores, ...coresFaltantes };
      } else if (configAtual[chave] === undefined) {
        configFaltante[chave] = valor;
      } else {
        contagem.ignorados++;
      }
    });
    if (configSemeadaSemEdicoes && Object.keys(localConfig).length) configFaltante.__seedDefault = false;
    if (Object.keys(configFaltante).length) {
      await update(ref(db, 'config'), configFaltante);
      contagem.configuracoes = Object.keys(configFaltante).length;
    }

    const categoriasSnapshot = await get(ref(db, 'categorias'));
    const categoriasAtuais = categoriasSnapshot.val() || {};
    const mapaCategorias = new Map();
    for (const categoria of localCategorias) {
      const equivalente = categoriasAtuais[categoria.id]
        ? [categoria.id, categoriasAtuais[categoria.id]]
        : Object.entries(categoriasAtuais).find(([, atual]) => assinaturaColecao('categorias', atual) === assinaturaColecao('categorias', categoria));
      if (equivalente) {
        if (categoria.id) mapaCategorias.set(categoria.id, equivalente[0]);
        const { id: idLocal, ...dados } = categoria;
        await update(ref(db, `categorias/${equivalente[0]}`), dados);
        categoriasAtuais[equivalente[0]] = { ...categoriasAtuais[equivalente[0]], ...dados };
        contagem.categorias++;
        continue;
      }
      const { id: idLocal, ...dados } = categoria;
      const novo = push(ref(db, 'categorias'));
      await set(novo, dados);
      categoriasAtuais[novo.key] = dados;
      if (idLocal) mapaCategorias.set(idLocal, novo.key);
      contagem.categorias++;
    }

    const produtosSnapshot = await get(ref(db, 'produtos'));
    const produtosAtuais = produtosSnapshot.val() || {};
    const mapaProdutos = new Map();
    for (const produto of localProdutos) {
      const assinatura = assinaturaColecao('produtos', produto, mapaCategorias);
      const equivalente = produtosAtuais[produto.id]
        ? [produto.id, produtosAtuais[produto.id]]
        : Object.entries(produtosAtuais).find(([, atual]) => atual.id === produto.id || assinaturaColecao('produtos', atual, mapaCategorias) === assinatura);
      const { id: idLocal, ...dados } = produto;
      dados.categoriaId = mapaCategorias.get(dados.categoriaId) || dados.categoriaId;
      if (equivalente) {
        await set(ref(db, `produtos/${equivalente[0]}`), dados);
        produtosAtuais[equivalente[0]] = dados;
        if (idLocal) mapaProdutos.set(idLocal, equivalente[0]);
        contagem.produtos++;
        continue;
      }
      const novo = push(ref(db, 'produtos'));
      await set(novo, dados);
      produtosAtuais[novo.key] = dados;
      if (idLocal) mapaProdutos.set(idLocal, novo.key);
      contagem.produtos++;
    }

    const clientesSnapshot = await get(ref(db, 'clientes'));
    const clientesAtuais = clientesSnapshot.val() || {};
    for (const cliente of localClientes) {
      const telefone = String(cliente.telefoneLimpo || cliente.telefone || cliente.id || '').replace(/\D/g, '');
      if (!telefone || clientesAtuais[telefone]) {
        contagem.ignorados++;
        continue;
      }
      await set(ref(db, `clientes/${telefone}`), {
        nome: String(cliente.nome || ''),
        telefone: String(cliente.telefone || telefone),
        telefoneLimpo: telefone,
        ...(cliente.endereco ? { endereco: String(cliente.endereco) } : {}),
        ...(cliente.referencia ? { referencia: String(cliente.referencia) } : {}),
        atualizadoEm: cliente.atualizadoEm || new Date().toISOString(),
        atualizadoEmTimestamp: Number(cliente.atualizadoEmTimestamp) || Date.now()
      });
      clientesAtuais[telefone] = cliente;
      contagem.clientes++;
    }

    const pedidosSnapshot = await get(ref(db, 'pedidos'));
    const privadosSnapshot = await get(ref(db, 'pedidosPrivados'));
    const pedidosAtuais = pedidosSnapshot.val() || {};
    const privadosAtuais = privadosSnapshot.val() || {};
    const assinaturasPedidos = new Set(Object.entries(pedidosAtuais).map(([id, pedido]) => assinaturaPedido(pedido, privadosAtuais[id])));
    for (const pedido of localPedidos) {
      const assinatura = assinaturaPedido(pedido, pedido);
      if (pedidosAtuais[pedido.id] || assinaturasPedidos.has(assinatura)) {
        contagem.ignorados++;
        continue;
      }
      const idNova = push(ref(db, 'pedidos')).key;
      const status = pedido.status === 'Novo' ? 'Recebido' : pedido.status || 'Recebido';
      const dataInicial = pedido.criadoEm || new Date().toISOString();
      const historicoLegado = Object.values(pedido.historico || {}).filter((evento) => evento && evento.status);
      const historico = historicoLegado.length
        ? Object.fromEntries(historicoLegado.map((evento) => {
          const eventoStatus = evento.status === 'Novo' ? 'Recebido' : evento.status;
          return [push(ref(db, `pedidos/${idNova}/historico`)).key, {
            status: eventoStatus,
            dataHora: evento.dataHora || dataInicial,
            ...(evento.motivo ? { motivo: String(evento.motivo).slice(0, 500) } : {})
          }];
        }))
        : { [push(ref(db, `pedidos/${idNova}/historico`)).key]: { status, dataHora: dataInicial } };
      const itensPrivados = (pedido.itens || []).map((item) => ({
        id: mapaProdutos.get(item.id) || item.id,
        nome: String(item.nome || 'Item'),
        quantidade: Number(item.quantidade) || 1,
        precoUnit: Number(item.precoUnit) || 0,
        ...(item.observacao ? { observacao: String(item.observacao).slice(0, 240) } : {})
      }));
      const clientePrivado = {
        nome: String(pedido.cliente?.nome || 'Cliente'),
        telefone: String(pedido.cliente?.telefone || ''),
        ...(pedido.cliente?.endereco ? { endereco: String(pedido.cliente.endereco).slice(0, 240) } : {}),
        ...(pedido.cliente?.referencia ? { referencia: String(pedido.cliente.referencia).slice(0, 240) } : {})
      };
      const subtotalPedido = Number(pedido.subtotal) || 0;
      const taxaPedido = Number(pedido.taxa) || 0;
      const publico = {
        numero: Number(pedido.numero) || Date.now(),
        status,
        criadoEm: dataInicial,
        criadoEmTimestamp: Number(pedido.criadoEmTimestamp) || Date.now(),
        tipo: pedido.tipo === 'retirada' ? 'retirada' : 'entrega',
        itens: itensPrivados.map(({ id, nome, quantidade, precoUnit }) => ({ id, nome, quantidade, precoUnit })),
        subtotal: subtotalPedido,
        taxa: taxaPedido,
        total: Number(pedido.total) || 0,
        pagamento: pedido.pagamento?.forma || pedido.pagamento || 'não informado',
        historico
      };
      const privado = {
        cliente: clientePrivado,
        itens: itensPrivados,
        subtotal: subtotalPedido,
        taxa: taxaPedido,
        pagamento: pedido.pagamento || { forma: 'pix' },
        observacaoGeral: pedido.observacaoGeral || '',
        criadoEmTimestamp: Number(pedido.criadoEmTimestamp) || Date.now()
      };
      await update(ref(db), {
        [`pedidos/${idNova}`]: publico,
        [`pedidosPrivados/${idNova}`]: privado
      });
      pedidosAtuais[idNova] = publico;
      privadosAtuais[idNova] = privado;
      assinaturasPedidos.add(assinaturaPedido(publico, privado));
      contagem.pedidos++;
    }

    localStorage.setItem(chaveMigracao, JSON.stringify({ concluidaEm: new Date().toISOString(), contagem }));
    return contagem;
  } catch (erro) {
    reportarErroFirebase('migração de dados locais', 'config, categorias, produtos, clientes e pedidos', erro);
    throw erro;
  }
}

// --------------------------------------------------------------------------
// AUTENTICAÇÃO
// --------------------------------------------------------------------------
export function assinarEstadoAutenticacao(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function loginAdmin(email, senha, manterConectado = true) {
  if (!auth) throw new Error("Módulo de autenticação não configurado.");
  const persistencia = manterConectado ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistencia);
  return signInWithEmailAndPassword(auth, email, senha);
}

export async function logoutAdmin() {
  if (!auth) return;
  return signOut(auth);
}
