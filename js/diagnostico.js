import {
  assinarConexaoFirebase,
  assinarEstadoAutenticacao,
  auth,
  conexaoValida,
  db
} from './modules/firebase-service.js';
import { ADMIN_UID, ADMIN_UID_CONFIGURADO, firebaseConfig, firebaseConfigValida } from './firebase.js';
import { get, ref, remove, set } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js';

const statusEl = document.getElementById('diagnostico-auth');
const listaEl = document.getElementById('diagnostico-resultados');
const botaoEl = document.getElementById('btn-executar-diagnostico');
let usuarioAtual = null;
let testeEmExecucao = false;

function mostrarResultado(titulo, detalhe, status) {
  const item = document.createElement('li');
  item.className = 'diagnostico-item';
  item.dataset.status = status;
  const nome = document.createElement('strong');
  nome.textContent = `${status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️'} ${titulo}`;
  const descricao = document.createElement('span');
  descricao.textContent = detalhe;
  item.append(nome, descricao);
  listaEl.append(item);
}

function esperarConexao() {
  return new Promise((resolve) => {
    let encerrado = false;
    let unsubscribe = () => {};
    const timer = setTimeout(() => finalizar(false), 7000);
    const finalizar = (valor) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(valor);
    };
    unsubscribe = assinarConexaoFirebase(finalizar);
  });
}

async function executarDiagnostico() {
  if (testeEmExecucao || !usuarioAtual || usuarioAtual.uid !== ADMIN_UID || !ADMIN_UID_CONFIGURADO) return;
  testeEmExecucao = true;
  botaoEl.disabled = true;
  botaoEl.textContent = 'Executando...';
  listaEl.replaceChildren();

  try {
    mostrarResultado('Configuração Firebase', `${firebaseConfig.projectId} · ${firebaseConfig.databaseURL}`, firebaseConfigValida ? 'pass' : 'fail');
    const conectado = await esperarConexao();
    mostrarResultado('.info/connected', conectado ? 'Realtime Database conectado.' : 'Sem conexão; verifique rede e databaseURL.', conectado ? 'pass' : 'fail');
    if (!conectado || !conexaoValida || !db) return;

    mostrarResultado('Firebase Auth', `Usuário autenticado: ${auth.currentUser?.email || 'sim'} · UID ${auth.currentUser?.uid || 'indisponível'}`, auth.currentUser?.uid === ADMIN_UID ? 'pass' : 'fail');
    const leituras = [
      ['config', '/config'],
      ['categorias', '/categorias'],
      ['produtos', '/produtos']
    ];
    for (const [nome, caminho] of leituras) {
      const inicio = performance.now();
      try {
        const snapshot = await get(ref(db, caminho));
        const duracao = Math.round(performance.now() - inicio);
        const contagem = snapshot.numChildren();
        mostrarResultado(`Leitura ${caminho}`, snapshot.exists() ? `${contagem} campo(s)/registro(s), ${duracao} ms.` : `Nó vazio, ${duracao} ms.`, snapshot.exists() ? 'pass' : 'warn');
      } catch (erro) {
        mostrarResultado(`Leitura ${caminho}`, `${erro.code || ''} ${erro.message}`, 'fail');
      }
    }

    const chavesNegocio = Object.keys(localStorage).filter((chave) => /^casabranca_db_(config|categorias|produtos|clientes|pedidos)$/.test(chave));
    mostrarResultado('Dados de negócio locais', chavesNegocio.length ? `${chavesNegocio.length} chave(s) legada(s) detectada(s); use a migração admin.` : 'Nenhuma cópia local de negócio detectada.', chavesNegocio.length ? 'warn' : 'pass');

    const idTeste = `teste-${Date.now()}`;
    const caminhoTeste = `diagnosticos/${usuarioAtual.uid}/${idTeste}`;
    try {
      await set(ref(db, caminhoTeste), { uid: usuarioAtual.uid, criadoEm: new Date().toISOString() });
      await remove(ref(db, caminhoTeste));
      mostrarResultado('Gravação e remoção de teste', 'Registro temporário gravado e removido com sucesso.', 'pass');
    } catch (erro) {
      mostrarResultado('Gravação e remoção de teste', `${erro.code || ''} ${erro.message}`, 'fail');
    }
  } catch (erro) {
    console.error('Diagnóstico Firebase falhou:', erro);
    mostrarResultado('Erro do diagnóstico', `${erro.code || ''} ${erro.message}`, 'fail');
  } finally {
    testeEmExecucao = false;
    botaoEl.disabled = !usuarioAtual || usuarioAtual.uid !== ADMIN_UID || !ADMIN_UID_CONFIGURADO;
    botaoEl.textContent = 'Executar diagnóstico';
  }
}

assinarEstadoAutenticacao((usuario) => {
  usuarioAtual = usuario;
  if (!conexaoValida || !firebaseConfigValida) {
    statusEl.textContent = 'Firebase não configurado. Corrija js/firebase.js antes do diagnóstico.';
    return;
  }
  if (!ADMIN_UID_CONFIGURADO) {
    statusEl.textContent = 'Configure ADMIN_UID em js/firebase.js e nas regras antes de executar o diagnóstico.';
    return;
  }
  if (!usuario || usuario.uid !== ADMIN_UID) {
    statusEl.textContent = 'Acesso restrito ao administrador autenticado. Entre no admin e abra esta página novamente.';
    return;
  }
  statusEl.textContent = `Autenticado como admin · UID ${usuario.uid}`;
  botaoEl.disabled = false;
  executarDiagnostico();
});

botaoEl.addEventListener('click', executarDiagnostico);
