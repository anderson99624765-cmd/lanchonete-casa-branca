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
  const pedidoCompleto = {
    ...pedido,
    numero: numeroPedido,
    status: "Novo",
    criadoEm: new Date().toISOString(),
    criadoEmTimestamp: Date.now()
  };

  try {
    let pedidos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS) || "[]");
    const novoId = "ped-" + Date.now();
    pedidos.unshift({ id: novoId, ...pedidoCompleto });
    localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(pedidos));
    if (canalSync) canalSync.postMessage({ tipo: 'pedidos_alterados' });
  } catch (e) {
    console.warn("Erro ao salvar pedido localmente:", e);
  }

  if (conexaoValida && db) {
    const pedidosRef = ref(db, "pedidos");
    const novoPedidoRef = push(pedidosRef);
    await set(novoPedidoRef, pedidoCompleto);
    return { id: novoPedidoRef.key, ...pedidoCompleto };
  }

  return { id: "ped-" + Date.now(), ...pedidoCompleto };
}

export function assinarPedidos(callback) {
  if (conexaoValida && db) {
    const pedidosRef = ref(db, "pedidos");
    return onValue(pedidosRef, (snapshot) => {
      const dados = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          dados.push({ id: child.key, ...child.val() });
        });
        dados.sort((a, b) => (b.criadoEmTimestamp || 0) - (a.criadoEmTimestamp || 0));
      }
      callback(dados);
    }, (err) => {
      console.warn("RTDB pedidos listener falhou:", err);
      carregarPedidosLocal(callback);
    });
  } else {
    carregarPedidosLocal(callback);

    const onBroadcast = (e) => {
      if (e.data?.tipo === 'pedidos_alterados') {
        carregarPedidosLocal(callback);
      }
    };
    if (canalSync) canalSync.addEventListener('message', onBroadcast);

    return () => {
      if (canalSync) canalSync.removeEventListener('message', onBroadcast);
    };
  }
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

export async function atualizarStatusPedido(pedidoId, novoStatus) {
  try {
    let pedidos = JSON.parse(localStorage.getItem(STORAGE_KEYS.PEDIDOS) || "[]");
    const p = pedidos.find(item => item.id === pedidoId);
    if (p) {
      p.status = novoStatus;
      p.atualizadoEm = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(pedidos));
      if (canalSync) canalSync.postMessage({ tipo: 'pedidos_alterados' });
    }
  } catch (e) {
    console.warn("Erro ao atualizar status local:", e);
  }

  if (conexaoValida && db) {
    return update(ref(db, `pedidos/${pedidoId}`), {
      status: novoStatus,
      atualizadoEm: new Date().toISOString()
    });
  }
  return true;
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
