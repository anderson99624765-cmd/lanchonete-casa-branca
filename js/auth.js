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
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  conexaoValida 
} from "./modules/firebase-service.js";
import { mostrarToast } from "./modules/utils.js";

// Configurações de tempo para encerramento de sessão por inatividade
const TEMPO_INATIVIDADE_MS = 2 * 60 * 60 * 1000; // 2 horas de inatividade
let timerInatividade = null;

try {
  localStorage.removeItem('casabranca_admin_auth_session');
  sessionStorage.removeItem('casabranca_admin_auth_session');
} catch (erro) {
  console.warn('Não foi possível remover uma sessão local antiga:', erro);
}

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

    case 'firebase/not-configured':
      return 'Firebase não configurado. Preencha js/firebase.js para autenticar e usar o painel.';

    case 'auth/not-authenticated':
      return 'Sua sessão Firebase expirou. Entre novamente para continuar.';

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

const EVENTOS_ATIVIDADE = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
let aoInteragir = null;

/**
 * Gerenciador de Inatividade do Administrador (Auto-logout após 2 horas sem interação)
 */
export function iniciarMonitorInatividade() {
  pararMonitorInatividade();

  aoInteragir = () => {
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

  EVENTOS_ATIVIDADE.forEach((evt) => window.addEventListener(evt, aoInteragir, { passive: true }));
  aoInteragir();
}

export function pararMonitorInatividade() {
  if (timerInatividade) {
    clearTimeout(timerInatividade);
    timerInatividade = null;
  }
  if (aoInteragir) {
    EVENTOS_ATIVIDADE.forEach((evt) => window.removeEventListener(evt, aoInteragir));
    aoInteragir = null;
  }
}

/**
 * Assina o estado de autenticação do administrador
 */
export function assinarEstadoAutenticacao(callback) {
  if (!conexaoValida || !auth) {
    callback(null);
    return () => {};
  }
  return assinarAuthFirebase(callback);
}

/**
 * Realiza o login do administrador
 */
export async function loginAdmin(email, senha, manterConectado = true) {
  const emailNorm = (email || '').trim().toLowerCase();
  if (!conexaoValida || !auth) throw { code: 'firebase/not-configured' };
  const userCred = await loginAdminFirebase(emailNorm, senha, manterConectado);
  return userCred.user;
}

/**
 * Realiza o encerramento seguro da sessão
 */
export async function logoutAdmin() {
  if (!conexaoValida || !auth) throw { code: 'firebase/not-configured' };
  await logoutAdminFirebase();
}

/**
 * Envia e-mail de recuperação de senha pelo Firebase Auth
 */
export async function recuperarSenha(email) {
  const emailNorm = (email || '').trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes('@')) {
    throw { code: 'auth/invalid-email' };
  }

  if (!conexaoValida || !auth) throw { code: 'firebase/not-configured' };
  return sendPasswordResetEmail(auth, emailNorm);
}

/**
 * Altera a senha do administrador
 */
export async function alterarSenhaAdmin(senhaAtual, novaSenha) {
  const validacao = validarForcaSenha(novaSenha);
  if (!validacao.valido) {
    throw new Error(validacao.mensagem);
  }

  if (!conexaoValida || !auth?.currentUser) throw { code: 'auth/not-authenticated' };
  const user = auth.currentUser;
  const credencial = EmailAuthProvider.credential(user.email, senhaAtual);
  await reauthenticateWithCredential(user, credencial);
  return updatePassword(user, novaSenha);
}

/**
 * Solicita a troca do e-mail de acesso (exige confirmação por link no novo e-mail)
 */
export async function alterarEmailAdmin(senhaAtual, novoEmail) {
  const novoEmailNorm = (novoEmail || '').trim().toLowerCase();
  if (!novoEmailNorm || !novoEmailNorm.includes('@')) {
    throw { code: 'auth/invalid-email' };
  }

  if (!conexaoValida || !auth?.currentUser) throw { code: 'auth/not-authenticated' };
  const user = auth.currentUser;
  const credencial = EmailAuthProvider.credential(user.email, senhaAtual);
  await reauthenticateWithCredential(user, credencial);
  // updateEmail foi descontinuado: o Firebase envia um link de confirmação ao novo e-mail.
  return verifyBeforeUpdateEmail(user, novoEmailNorm);
}

export { auth };
