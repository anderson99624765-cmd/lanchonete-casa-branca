// ==========================================================================
// Serviço do Firebase - RTDB, Auth e Inicialização (Seed)
// Utiliza Firebase SDK v10 via ESM CDN e suporte offline/local persistente
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  push, 
  update, 
  remove, 
  onValue, 
  off 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { firebaseConfig, CONFIG_PADRAO } from "./firebase-config.js";

// Inicialização da aplicação Firebase
let app = null;
let db = null;
let auth = null;
let conexaoValida = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_AQUI") {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    conexaoValida = true;
    console.info("Firebase SDK inicializado com sucesso.");
  } else {
    console.warn("Chaves reais do Firebase não inseridas. Sistema operando com persistência LocalStorage/BroadcastChannel sincronizada em tempo real.");
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
  reauthenticateWithCredential, 
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
};

// ==========================================================================
// CANAL DE SINCRONIZAÇÃO EM TEMPO REAL ENTRE ABAS (BROADCAST CHANNEL)
// Permite que qualquer alteração no admin reflita no cliente na mesma hora
// ==========================================================================
const canalSync = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('casabranca_realtime_sync') : null;

// Chaves de armazenamento local
const STORAGE_KEYS = {
  CONFIG: 'casabranca_db_config',
  CATEGORIAS: 'casabranca_db_categorias',
  PRODUTOS: 'casabranca_db_produtos',
  PEDIDOS: 'casabranca_db_pedidos',
  PEDIDOS_RECENTES: 'casabranca_pedidos_recentes',
  CLIENTES: 'casabranca_db_clientes'
};

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
  if (conexaoValida && db) {
    try {
      const configSnapshot = await get(ref(db, "config"));
      if (!configSnapshot.exists()) {
        await set(ref(db, "config"), CONFIG_PADRAO);
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
          await push(produtosRef, { ...prod, categoriaId: salgadosId });
        }
      }
    } catch (err) {
      console.error("Erro no seed do Firebase:", err);
    }
  } else {
    // Seed local garantido
    if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(CONFIG_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIAS)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(SEED_CATEGORIAS_INICIAIS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUTOS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(SEED_PRODUTOS_INICIAIS));
    }
  }
}

// --------------------------------------------------------------------------
// MÉTODOS DE CONFIGURAÇÃO DO SITE (/config)
// --------------------------------------------------------------------------
export function assinarConfiguracoes(callback) {
  if (conexaoValida && db) {
    const configRef = ref(db, "config");
    return onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(val));
        callback(val);
      } else {
        callback(CONFIG_PADRAO);
      }
    }, (err) => {
      console.warn("RTDB config listener falhou, usando local:", err);
      carregarConfigLocal(callback);
    });
  } else {
    carregarConfigLocal(callback);

    const onStorage = (e) => {
      if (e.key === STORAGE_KEYS.CONFIG) {
        carregarConfigLocal(callback);
      }
    };
    window.addEventListener('storage', onStorage);

    const onBroadcast = (e) => {
      if (e.data?.tipo === 'config_alterada') {
        carregarConfigLocal(callback);
      }
    };
    if (canalSync) canalSync.addEventListener('message', onBroadcast);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (canalSync) canalSync.removeEventListener('message', onBroadcast);
    };
  }
}

function carregarConfigLocal(callback) {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (salvo) {
      callback({ ...CONFIG_PADRAO, ...JSON.parse(salvo) });
      return;
    }
  } catch (e) {
    console.warn("Erro ao ler config local:", e);
  }
  callback(CONFIG_PADRAO);
}

export async function salvarConfiguracoes(novasConfigs) {
  // Salva imediatamente no localStorage para garantir persistência instantânea
  try {
    const atual = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || "{}");
    const merged = { ...CONFIG_PADRAO, ...atual, ...novasConfigs };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(merged));
    if (canalSync) canalSync.postMessage({ tipo: 'config_alterada', dados: merged });
  } catch (e) {
    console.warn("Erro ao gravar config no cache local:", e);
  }

  if (conexaoValida && db) {
    return update(ref(db, "config"), novasConfigs);
  }
  return true;
}

// --------------------------------------------------------------------------
// MÉTODOS DE CATEGORIAS (/categorias)
// --------------------------------------------------------------------------
export function assinarCategorias(callback) {
  if (conexaoValida && db) {
    const catRef = ref(db, "categorias");
    return onValue(catRef, (snapshot) => {
      const dados = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          dados.push({ id: child.key, ...child.val() });
        });
        dados.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(dados));
      }
      callback(dados);
    }, (err) => {
      console.warn("RTDB categorias listener falhou, usando local:", err);
      carregarCategoriasLocal(callback);
    });
  } else {
    carregarCategoriasLocal(callback);

    const onStorage = (e) => {
      if (e.key === STORAGE_KEYS.CATEGORIAS) {
        carregarCategoriasLocal(callback);
      }
    };
    window.addEventListener('storage', onStorage);

    const onBroadcast = (e) => {
      if (e.data?.tipo === 'categorias_alteradas') {
        carregarCategoriasLocal(callback);
      }
    };
    if (canalSync) canalSync.addEventListener('message', onBroadcast);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (canalSync) canalSync.removeEventListener('message', onBroadcast);
    };
  }
}

function carregarCategoriasLocal(callback) {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.CATEGORIAS);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      parsed.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      callback(parsed);
      return;
    }
  } catch (e) {
    console.warn("Erro ao ler categorias locais:", e);
  }
  callback(SEED_CATEGORIAS_INICIAIS);
}

export async function salvarCategoria(categoria, id = null) {
  // Atualiza cache local imediatamente
  try {
    let cats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIAS) || "[]");
    if (!cats || cats.length === 0) cats = [...SEED_CATEGORIAS_INICIAIS];

    if (id) {
      const idx = cats.findIndex(c => c.id === id);
      if (idx > -1) {
        cats[idx] = { ...cats[idx], ...categoria, id };
      }
    } else {
      const novoId = "cat-" + Date.now();
      cats.push({ ...categoria, id: novoId });
    }
    cats.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(cats));
    if (canalSync) canalSync.postMessage({ tipo: 'categorias_alteradas' });
  } catch (e) {
    console.warn("Erro ao atualizar categoria localmente:", e);
  }

  if (conexaoValida && db) {
    if (id) {
      return update(ref(db, `categorias/${id}`), categoria);
    } else {
      return push(ref(db, "categorias"), categoria);
    }
  }
  return true;
}

export async function excluirCategoria(id) {
  try {
    let cats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIAS) || "[]");
    cats = cats.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(cats));
    if (canalSync) canalSync.postMessage({ tipo: 'categorias_alteradas' });
  } catch (e) {
    console.warn("Erro ao excluir categoria localmente:", e);
  }

  if (conexaoValida && db) {
    return remove(ref(db, `categorias/${id}`));
  }
  return true;
}

// --------------------------------------------------------------------------
// MÉTODOS DE PRODUTOS (/produtos)
// --------------------------------------------------------------------------
export function assinarProdutos(callback) {
  if (conexaoValida && db) {
    const prodRef = ref(db, "produtos");
    return onValue(prodRef, (snapshot) => {
      const dados = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          dados.push({ id: child.key, ...child.val() });
        });
        localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(dados));
      }
      callback(dados);
    }, (err) => {
      console.warn("RTDB produtos listener falhou, usando local:", err);
      carregarProdutosLocal(callback);
    });
  } else {
    carregarProdutosLocal(callback);

    const onStorage = (e) => {
      if (e.key === STORAGE_KEYS.PRODUTOS) {
        carregarProdutosLocal(callback);
      }
    };
    window.addEventListener('storage', onStorage);

    const onBroadcast = (e) => {
      if (e.data?.tipo === 'produtos_alterados') {
        carregarProdutosLocal(callback);
      }
    };
    if (canalSync) canalSync.addEventListener('message', onBroadcast);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (canalSync) canalSync.removeEventListener('message', onBroadcast);
    };
  }
}

function carregarProdutosLocal(callback) {
  try {
    const salvo = localStorage.getItem(STORAGE_KEYS.PRODUTOS);
    if (salvo) {
      callback(JSON.parse(salvo));
      return;
    }
  } catch (e) {
    console.warn("Erro ao ler produtos locais:", e);
  }
  callback(SEED_PRODUTOS_INICIAIS);
}

export async function salvarProduto(produto, id = null) {
  try {
    let prods = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUTOS) || "[]");
    if (!prods || prods.length === 0) prods = [...SEED_PRODUTOS_INICIAIS];

    if (id) {
      const idx = prods.findIndex(p => p.id === id);
      if (idx > -1) {
        prods[idx] = { ...prods[idx], ...produto, id };
      }
    } else {
      const novoId = "prod-" + Date.now();
      prods.push({ ...produto, id: novoId });
    }
    localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(prods));
    if (canalSync) canalSync.postMessage({ tipo: 'produtos_alterados' });
  } catch (e) {
    console.warn("Erro ao salvar produto localmente:", e);
  }

  if (conexaoValida && db) {
    if (id) {
      return update(ref(db, `produtos/${id}`), produto);
    } else {
      return push(ref(db, "produtos"), produto);
    }
  }
  return true;
}

export async function excluirProduto(id) {
  try {
    let prods = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUTOS) || "[]");
    prods = prods.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(prods));
    if (canalSync) canalSync.postMessage({ tipo: 'produtos_alterados' });
  } catch (e) {
    console.warn("Erro ao excluir produto localmente:", e);
  }

  if (conexaoValida && db) {
    return remove(ref(db, `produtos/${id}`));
  }
  return true;
}

// --------------------------------------------------------------------------
// MÉTODOS DE CLIENTES (/clientes)
// --------------------------------------------------------------------------
export async function buscarClientePorTelefone(telefoneLimpo) {
  if (!telefoneLimpo) return null;
  if (conexaoValida && db) {
    try {
      const snap = await get(ref(db, `clientes/${telefoneLimpo}`));
      if (snap.exists()) return snap.val();
    } catch (e) {
      console.warn("Busca de cliente no RTDB falhou, buscando local:", e);
    }
  }

  try {
    const clientes = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTES) || "{}");
    return clientes[telefoneLimpo] || null;
  } catch (e) {
    return null;
  }
}

export async function salvarCliente(cliente) {
  const telLimpo = (cliente.telefone || "").replace(/\D/g, "");
  if (!telLimpo) return;

  const clienteData = {
    ...cliente,
    telefoneLimpo: telLimpo,
    atualizadoEm: new Date().toISOString()
  };

  try {
    const clientes = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTES) || "{}");
    clientes[telLimpo] = clienteData;
    localStorage.setItem(STORAGE_KEYS.CLIENTES, JSON.stringify(clientes));
    if (canalSync) canalSync.postMessage({ tipo: 'clientes_alterados' });
  } catch (e) {
    console.warn("Erro ao salvar cliente localmente:", e);
  }

  if (conexaoValida && db) {
    return set(ref(db, `clientes/${telLimpo}`), clienteData);
  }
  return true;
}

export function assinarClientes(callback) {
  if (conexaoValida && db) {
    const clientRef = ref(db, "clientes");
    return onValue(clientRef, (snapshot) => {
      const dados = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          dados.push({ id: child.key, ...child.val() });
        });
      }
      callback(dados);
    }, (err) => {
      console.warn("RTDB clientes listener falhou:", err);
      carregarClientesLocal(callback);
    });
  } else {
    carregarClientesLocal(callback);

    const onBroadcast = (e) => {
      if (e.data?.tipo === 'clientes_alterados') {
        carregarClientesLocal(callback);
      }
    };
    if (canalSync) canalSync.addEventListener('message', onBroadcast);

    return () => {
      if (canalSync) canalSync.removeEventListener('message', onBroadcast);
    };
  }
}

function carregarClientesLocal(callback) {
  try {
    const clientesMap = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTES) || "{}");
    const arr = Object.keys(clientesMap).map(k => ({ id: k, ...clientesMap[k] }));
    callback(arr);
  } catch (e) {
    callback([]);
  }
}

// --------------------------------------------------------------------------
// MÉTODOS DE PEDIDOS (/pedidos)
// --------------------------------------------------------------------------
export async function criarPedido(pedido) {
  const numeroPedido = Math.floor(1000 + Math.random() * 9000);
  const criadoEm = new Date().toISOString();
  const criadoEmTimestamp = Date.now();
  const status = "Recebido";

  if (conexaoValida && db) {
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
      itens: (pedido.itens || []).map(({ nome, quantidade, precoUnit }) => ({ nome, quantidade, precoUnit })),
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
      observacaoGeral: pedido.observacaoGeral || ""
    };

    await update(ref(db), {
      [`pedidos/${id}`]: pedidoPublico,
      [`pedidosPrivados/${id}`]: pedidoPrivado
    });

    const pedidoCompleto = { id, ...pedidoPublico, ...pedidoPrivado };
    armazenarPedidoLocal(pedidoCompleto);
    registrarPedidoRecente(pedidoCompleto);
    return pedidoCompleto;
  }

  const id = `ped-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const pedidoCompleto = {
    id,
    ...pedido,
    numero: numeroPedido,
    status,
    criadoEm,
    criadoEmTimestamp,
    historico: { [`evt-${criadoEmTimestamp}`]: { status, dataHora: criadoEm } }
  };
  armazenarPedidoLocal(pedidoCompleto);
  registrarPedidoRecente(pedidoCompleto);
  return pedidoCompleto;
}

export function assinarPedidos(callback) {
  const caminhoPedidos = "/pedidos";
  console.log("[Pedidos] Caminho lido:", caminhoPedidos, conexaoValida ? "(Firebase RTDB)" : "(LocalStorage)");

  if (conexaoValida && db) {
    let unsubscribeLocal = null;
    let dadosPublicos = {};
    let dadosPrivados = {};
    const emitirPedidos = () => {
      const dados = Object.keys(dadosPublicos).map((id) => ({
        id,
        ...dadosPublicos[id],
        ...(dadosPrivados[id] || {})
      }));
      dados.sort((a, b) => (b.criadoEmTimestamp || 0) - (a.criadoEmTimestamp || 0));
      console.log("[Pedidos] Snapshot bruto (Firebase):", dadosPublicos);
      console.log("[Pedidos] Lista filtrada (status Recebido):", dados.filter((pedido) => pedido.status === "Recebido" || pedido.status === "Novo"));
      callback(dados);
    };
    const iniciarFallbackLocal = (err) => {
      console.warn("RTDB pedidos listener falhou:", err);
      if (!unsubscribeLocal) unsubscribeLocal = assinarPedidosLocal(callback);
    };
    const unsubscribePublicos = onValue(ref(db, caminhoPedidos), (snapshot) => {
      dadosPublicos = snapshot.val() || {};
      emitirPedidos();
    }, iniciarFallbackLocal);
    const unsubscribePrivados = onValue(ref(db, "pedidosPrivados"), (snapshot) => {
      dadosPrivados = snapshot.val() || {};
      emitirPedidos();
    }, iniciarFallbackLocal);

    return () => {
      unsubscribePublicos();
      unsubscribePrivados();
      if (unsubscribeLocal) unsubscribeLocal();
    };
  }

  return assinarPedidosLocal(callback);
}

function assinarPedidosLocal(callback) {
  const notificar = () => carregarPedidosLocal((pedidos) => {
    console.log("[Pedidos] Snapshot bruto (LocalStorage):", pedidos);
    console.log("[Pedidos] Lista filtrada (status Recebido):", pedidos.filter((pedido) => pedido.status === "Recebido" || pedido.status === "Novo"));
    callback(pedidos);
  });
  notificar();

  const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.PEDIDOS) notificar();
  };
  const onBroadcast = (event) => {
    if (event.data?.tipo === 'pedidos_alterados') notificar();
  };

  window.addEventListener('storage', onStorage);
  if (canalSync) canalSync.addEventListener('message', onBroadcast);

  return () => {
    window.removeEventListener('storage', onStorage);
    if (canalSync) canalSync.removeEventListener('message', onBroadcast);
  };
}

function carregarPedidosLocal(callback) {
  try {
    const pedidos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS) || "[]");
    pedidos.sort((a, b) => (b.criadoEmTimestamp || 0) - (a.criadoEmTimestamp || 0));
    callback(pedidos);
  } catch (e) {
    callback([]);
  }
}

function armazenarPedidoLocal(pedido) {
  try {
    let pedidos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS) || "[]");
    pedidos = pedidos.filter((item) => item.id !== pedido.id);
    pedidos.unshift(pedido);
    localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(pedidos));
    if (canalSync) canalSync.postMessage({ tipo: 'pedidos_alterados' });
  } catch (e) {
    console.warn("Erro ao guardar pedido localmente:", e);
  }
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
    localStorage.setItem(STORAGE_KEYS.PEDIDOS_RECENTES, JSON.stringify(recentes.slice(0, 10)));
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
    const recentes = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS_RECENTES) || "[]");
    return Array.isArray(recentes) ? recentes : [];
  } catch (e) {
    return [];
  }
}

function atualizarPedidoLocal(pedidoId, alteracoes, eventoHistorico = null) {
  try {
    const pedidos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS) || "[]");
    const pedido = pedidos.find((item) => item.id === pedidoId);
    if (!pedido) return;
    Object.assign(pedido, alteracoes);
    if (eventoHistorico) {
      pedido.historico = pedido.historico || {};
      pedido.historico[`evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`] = eventoHistorico;
    }
    localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(pedidos));
    if (canalSync) canalSync.postMessage({ tipo: 'pedidos_alterados' });
    const recentes = obterPedidosRecentes().map((item) => item.id === pedidoId ? { ...item, status: pedido.status } : item);
    localStorage.setItem(STORAGE_KEYS.PEDIDOS_RECENTES, JSON.stringify(recentes));
  } catch (e) {
    console.warn("Erro ao atualizar pedido local:", e);
  }
}

export function assinarPedidoPublico(pedidoId, callback, aoFalhar = () => {}) {
  if (!pedidoId || /[.#$/\[\]]/.test(pedidoId)) {
    aoFalhar(new Error("Identificador de pedido inválido."));
    return () => {};
  }

  if (conexaoValida && db) {
    return onValue(ref(db, `pedidos/${pedidoId}`), (snapshot) => {
      callback(snapshot.exists() ? { id: pedidoId, ...snapshot.val() } : null);
    }, aoFalhar);
  }

  const notificar = () => {
    try {
      const pedidos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS) || "[]");
      callback(pedidos.find((pedido) => pedido.id === pedidoId) || null);
    } catch (e) {
      aoFalhar(e);
    }
  };
  notificar();
  const onStorage = (event) => {
    if (event.key === STORAGE_KEYS.PEDIDOS) notificar();
  };
  const onBroadcast = (event) => {
    if (event.data?.tipo === 'pedidos_alterados') notificar();
  };
  window.addEventListener('storage', onStorage);
  if (canalSync) canalSync.addEventListener('message', onBroadcast);
  return () => {
    window.removeEventListener('storage', onStorage);
    if (canalSync) canalSync.removeEventListener('message', onBroadcast);
  };
}

export async function atualizarStatusPedido(pedidoId, novoStatus, opcoes = {}) {
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

  if (conexaoValida && db) {
    const eventoRef = push(ref(db, `pedidos/${pedidoId}/historico`));
    alteracoes[`pedidos/${pedidoId}/historico/${eventoRef.key}`] = evento;
    return update(ref(db), alteracoes);
  }

  atualizarPedidoLocal(pedidoId, {
    status: novoStatus,
    atualizadoEm: dataHora,
    ...(opcoes.motivoCancelamento ? { motivoCancelamento: opcoes.motivoCancelamento } : {}),
    ...(opcoes.estimativa ? { estimativa: opcoes.estimativa } : {})
  }, evento);
  return true;
}

export async function salvarEstimativaPedido(pedidoId, estimativa) {
  if (conexaoValida && db) {
    return update(ref(db), { [`pedidos/${pedidoId}/estimativa`]: estimativa });
  }
  atualizarPedidoLocal(pedidoId, { estimativa });
  return true;
}

export async function registrarNotificacaoPedido(pedidoId, status, enviado) {
  const notificacao = {
    status: String(status || ''),
    dataHora: new Date().toISOString(),
    enviado: Boolean(enviado)
  };

  if (conexaoValida && db) {
    const notificacaoRef = push(ref(db, `pedidos/${pedidoId}/notificacoes`));
    await set(notificacaoRef, notificacao);
    return { id: notificacaoRef.key, ...notificacao };
  }

  try {
    const pedidos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS) || '[]');
    const pedido = pedidos.find((item) => item.id === pedidoId);
    if (!pedido) throw new Error('Pedido não encontrado no armazenamento local.');
    pedido.notificacoes = pedido.notificacoes || {};
    const id = `aviso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pedido.notificacoes[id] = notificacao;
    localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(pedidos));
    if (canalSync) canalSync.postMessage({ tipo: 'pedidos_alterados' });
    return { id, ...notificacao };
  } catch (error) {
    console.error('Erro ao registrar aviso do pedido:', error);
    throw error;
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
