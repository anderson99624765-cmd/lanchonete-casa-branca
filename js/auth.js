// ==========================================================================
// Módulo de Autenticação e Segurança do Administrador (auth.js)
// Lanchonete Casa Branca
// ==========================================================================

import { 
  auth, 
  loginAdmin as loginAdminFirebase, 
  logoutAdmin as logoutAdminFirebase, 
  assinarEstadoAutenticacao as assinarAuthFirebase,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  conexaoValida 
} from "./modules/firebase-service.js";
import { mostrarToast, sanitizarTexto } from "./modules/utils.js";

// Credenciais de Administrador definidas para o sistema
export const ADMIN_CREDENCIAIS = {
  email: "casabranca@gmail.com",
  senha: "casabranca1379"
};

// Chave para persistência local de sessão administrativa
const STORAGE_ADMIN_SESSION_KEY = "casabranca_admin_auth_session";

// Configurações de tempo para encerramento de sessão por inatividade
const TEMPO_INATIVIDADE_MS = 2 * 60 * 60 * 1000; // 2 horas de inatividade
let timerInatividade = null;
let callbackAuthCadastrado = null;

/**
 * Tradutor de códigos de erro para português amigável e seguro
 * Não revela especificamente qual dos campos está errado
 * @param {string} codigo 
 * @returns {string}
 */
export function traduzirErroAuth(codigo) {
  switch (codigo) {
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou senha incorretos. Por favor, verifique os dados digitados.';
    
    case 'auth/too-many-requests':
      return 'Acesso temporariamente bloqueado devido a muitas tentativas inválidas. Aguarde alguns minutos ou redefina sua senha.';
    
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet. Verifique sua rede e tente novamente.';

    case 'auth/user-disabled':
      return 'Esta conta de administrador foi desativada pelo painel.';

    case 'auth/weak-password':
      return 'A senha digitada é muito fraca. Utilize ao menos 8 caracteres misturando letras e números.';

    case 'auth/email-already-in-use':
      return 'Este novo e-mail já está sendo utilizado por outra conta.';

    case 'auth/requires-recent-login':
      return 'Por questões de segurança, faça login novamente antes de realizar esta alteração.';

    default:
      return 'Não foi possível concluir a autenticação. Tente novamente mais tarde.';
  }
}

/**
 * Validador de Senha Forte
 * Regras: Mínimo de 8 caracteres, contendo pelo menos uma letra e pelo menos um número
 * Retorna { valido: boolean, forca: 'fraca'|'media'|'forte', mensagem: string }
 * @param {string} senha 
 */
export function validarForcaSenha(senha) {
  if (!senha || senha.length < 8) {
    return {
      valido: false,
      forca: 'fraca',
      mensagem: 'Mínimo de 8 caracteres.'
    };
  }

  const temLetra = /[a-zA-Z]/.test(senha);
  const temNumero = /[0-9]/.test(senha);
  const temSimbolo = /[^a-zA-Z0-9]/.test(senha);

  if (!temLetra || !temNumero) {
    return {
      valido: false,
      forca: 'fraca',
      mensagem: 'Deve conter letras e números.'
    };
  }

  if (senha.length >= 10 && temSimbolo) {
    return {
      valido: true,
      forca: 'forte',
      mensagem: 'Senha forte e segura!'
    };
  }

  return {
    valido: true,
    forca: 'media',
    mensagem: 'Senha adequada (boa).'
  };
}

/**
 * Gerenciador de Inatividade do Administrador (Auto-logout após 2 horas sem interação)
 */
export function iniciarMonitorInatividade() {
  pararMonitorInatividade();

  const resetarTimer = () => {
    clearTimeout(timerInatividade);
    timerInatividade = setTimeout(async () => {
      try {
        await logoutAdmin();
        mostrarToast('Sessão encerrada por inatividade (2 horas). Faça login novamente.', 'alerta', 8000);
      } catch (e) {
        console.warn('Erro ao encerrar sessão inativa:', e);
      }
    }, TEMPO_INATIVIDADE_MS);
  };

  ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetarTimer, { passive: true });
  });

  resetarTimer();
}

export function pararMonitorInatividade() {
  if (timerInatividade) {
    clearTimeout(timerInatividade);
    timerInatividade = null;
  }
}

/**
 * Assina o estado de autenticação do administrador
 */
export function assinarEstadoAutenticacao(callback) {
  callbackAuthCadastrado = callback;

  if (conexaoValida && auth) {
    return assinarAuthFirebase((user) => {
      if (user) {
        callback(user);
      } else {
        // Verifica se há sessão local ativa
        const localUser = checarSessaoLocal();
        callback(localUser);
      }
    });
  } else {
    // Modo com persistência local
    const localUser = checarSessaoLocal();
    callback(localUser);
    return () => {};
  }
}

function checarSessaoLocal() {
  try {
    const salvo = localStorage.getItem(STORAGE_ADMIN_SESSION_KEY) || sessionStorage.getItem(STORAGE_ADMIN_SESSION_KEY);
    if (salvo) {
      return JSON.parse(salvo);
    }
  } catch (e) {
    console.warn("Falha ao ler sessão local:", e);
  }
  return null;
}

/**
 * Realiza o login do administrador
 */
export async function loginAdmin(email, senha, manterConectado = true) {
  const emailNorm = (email || '').trim().toLowerCase();
  const senhaNorm = (senha || '').trim();

  // 1. Se o Firebase estiver com chaves conectadas no projeto
  if (conexaoValida && auth) {
    try {
      const userCred = await loginAdminFirebase(emailNorm, senhaNorm, manterConectado);
      return userCred.user;
    } catch (errFirebase) {
      // Se falhar no Firebase, valida se é a credencial padrão configurada
      if (emailNorm === ADMIN_CREDENCIAIS.email && senhaNorm === ADMIN_CREDENCIAIS.senha) {
        const userObj = {
          email: ADMIN_CREDENCIAIS.email,
          uid: "admin-casabranca-local",
          displayName: "Proprietário Casa Branca"
        };
        salvarSessaoLocal(userObj, manterConectado);
        if (callbackAuthCadastrado) callbackAuthCadastrado(userObj);
        return userObj;
      }
      throw errFirebase;
    }
  }

  // 2. Validação direta com as credenciais solicitadas (casabranca@gmail.com / casabranca1379)
  if (emailNorm === ADMIN_CREDENCIAIS.email && senhaNorm === ADMIN_CREDENCIAIS.senha) {
    const userObj = {
      email: ADMIN_CREDENCIAIS.email,
      uid: "admin-casabranca-local",
      displayName: "Proprietário Casa Branca"
    };
    salvarSessaoLocal(userObj, manterConectado);
    if (callbackAuthCadastrado) callbackAuthCadastrado(userObj);
    return userObj;
  } else {
    throw { code: 'auth/invalid-login-credentials' };
  }
}

function salvarSessaoLocal(userObj, manterConectado) {
  try {
    const dados = JSON.stringify(userObj);
    if (manterConectado) {
      localStorage.setItem(STORAGE_ADMIN_SESSION_KEY, dados);
      sessionStorage.removeItem(STORAGE_ADMIN_SESSION_KEY);
    } else {
      sessionStorage.setItem(STORAGE_ADMIN_SESSION_KEY, dados);
      localStorage.removeItem(STORAGE_ADMIN_SESSION_KEY);
    }
  } catch (e) {
    console.warn("Erro ao salvar sessão:", e);
  }
}

/**
 * Realiza o encerramento seguro da sessão
 */
export async function logoutAdmin() {
  try {
    localStorage.removeItem(STORAGE_ADMIN_SESSION_KEY);
    sessionStorage.removeItem(STORAGE_ADMIN_SESSION_KEY);
    if (conexaoValida && auth) {
      await logoutAdminFirebase();
    }
  } catch (e) {
    console.warn("Erro ao deslogar:", e);
  }
  if (callbackAuthCadastrado) callbackAuthCadastrado(null);
}

/**
 * Envia e-mail de recuperação de senha pelo Firebase Auth
 */
export async function recuperarSenha(email) {
  const emailNorm = (email || '').trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes('@')) {
    throw { code: 'auth/invalid-email' };
  }

  if (conexaoValida && auth) {
    return sendPasswordResetEmail(auth, emailNorm);
  } else {
    if (emailNorm === ADMIN_CREDENCIAIS.email) {
      return true;
    }
    throw { code: 'auth/user-not-found' };
  }
}

/**
 * Altera a senha do administrador
 */
export async function alterarSenhaAdmin(senhaAtual, novaSenha) {
  const validacao = validarForcaSenha(novaSenha);
  if (!validacao.valido) {
    throw new Error(validacao.mensagem);
  }

  if (conexaoValida && auth && auth.currentUser) {
    const user = auth.currentUser;
    const credencial = EmailAuthProvider.credential(user.email, senhaAtual);
    await reauthenticateWithCredential(user, credencial);
    return updatePassword(user, novaSenha);
  } else {
    if (senhaAtual !== ADMIN_CREDENCIAIS.senha) {
      throw { code: 'auth/wrong-password' };
    }
    ADMIN_CREDENCIAIS.senha = novaSenha;
    return true;
  }
}

/**
 * Altera o e-mail de acesso do administrador
 */
export async function alterarEmailAdmin(senhaAtual, novoEmail) {
  const novoEmailNorm = (novoEmail || '').trim().toLowerCase();
  if (!novoEmailNorm || !novoEmailNorm.includes('@')) {
    throw { code: 'auth/invalid-email' };
  }

  if (conexaoValida && auth && auth.currentUser) {
    const user = auth.currentUser;
    const credencial = EmailAuthProvider.credential(user.email, senhaAtual);
    await reauthenticateWithCredential(user, credencial);
    return updateEmail(user, novoEmailNorm);
  } else {
    if (senhaAtual !== ADMIN_CREDENCIAIS.senha) {
      throw { code: 'auth/wrong-password' };
    }
    ADMIN_CREDENCIAIS.email = novoEmailNorm;
    const localUser = checarSessaoLocal();
    if (localUser) {
      localUser.email = novoEmailNorm;
      localStorage.setItem(STORAGE_ADMIN_SESSION_KEY, JSON.stringify(localUser));
      if (callbackAuthCadastrado) callbackAuthCadastrado(localUser);
    }
    return true;
  }
}

export { auth };
