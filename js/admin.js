// ==========================================================================
// Lanchonete Casa Branca - Painel Administrativo Completo com Autenticação
// ==========================================================================

import { 
  assinarConfiguracoes,
  salvarConfiguracoes,
  assinarCategorias,
  salvarCategoria,
  excluirCategoria,
  assinarProdutos,
  salvarProduto,
  excluirProduto,
  assinarPedidos,
  atualizarStatusPedido,
  assinarClientes,
  verificarEExecutarSeed,
  conexaoValida 
} from "./modules/firebase-service.js";
import { 
  auth, 
  loginAdmin, 
  logoutAdmin, 
  assinarEstadoAutenticacao, 
  traduzirErroAuth,
  validarForcaSenha,
  iniciarMonitorInatividade,
  pararMonitorInatividade,
  recuperarSenha,
  alterarSenhaAdmin,
  alterarEmailAdmin
} from "./auth.js";
import { CONFIG_PADRAO } from "./modules/firebase-config.js";
import { 
  formatarMoeda, 
  sanitizarTexto, 
  mostrarToast, 
  tocarAlertaSonoro, 
  aplicarCoresCss, 
  limparTelefone 
} from "./modules/utils.js";

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Inicializando Painel Administrativo com Camada de Segurança...");

  // Garante semente de dados se necessário
  await verificarEExecutarSeed();

  // Elementos das Telas
  const telaLogin = document.getElementById('admin-tela-login');
  const telaPainel = document.getElementById('admin-tela-painel');
  const formLogin = document.getElementById('form-login-admin');
  const btnLogout = document.getElementById('btn-admin-logout');

  // Estado Geral
  let currentConfig = CONFIG_PADRAO;
  let currentCategorias = [];
  let currentProdutos = [];
  let currentPedidos = [];
  let currentClientes = [];
  let totalPedidosAnterior = null;
  let usuarioAutenticado = null;
  let listenersAtivos = [];

  // ========================================================================
  // 1. FLUXO DE AUTENTICAÇÃO E CONTROLE DE ACESSO
  // ========================================================================
  assinarEstadoAutenticacao((user) => {
    usuarioAutenticado = user;

    if (user) {
      console.log(`Administrador autenticado: ${user.email} (UID: ${user.uid})`);
      
      if (telaLogin) telaLogin.style.display = 'none';
      if (telaPainel) telaPainel.style.display = 'block';

      const elEmailDisplay = document.getElementById('admin-user-email-display');
      const elUidDisplay = document.getElementById('admin-user-uid-display');
      if (elEmailDisplay) elEmailDisplay.textContent = user.email || 'Não informado';
      if (elUidDisplay) elUidDisplay.textContent = user.uid || '-';

      iniciarMonitorInatividade();
      iniciarCarregamentoPainel();

    } else {
      pararMonitorInatividade();
      limparListenersAtivos();

      if (telaPainel) telaPainel.style.display = 'none';
      if (telaLogin) telaLogin.style.display = 'flex';
      console.log("Nenhum administrador logado. Exibindo estritamente tela de login.");
    }
  });

  function limparListenersAtivos() {
    listenersAtivos.forEach(unsubscribe => {
      try {
        if (typeof unsubscribe === 'function') unsubscribe();
      } catch (e) {
        console.warn("Erro ao desinscrever listener:", e);
      }
    });
    listenersAtivos = [];
    totalPedidosAnterior = null;
  }

  // ========================================================================
  // 2. FORMULÁRIO DE LOGIN
  // ========================================================================
  if (formLogin) {
    const btnSubmit = document.getElementById('btn-login-submit');
    const chkLembrar = document.getElementById('chk-lembrar-sessao');

    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value;
      const manterConectado = chkLembrar ? chkLembrar.checked : true;

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="spinner-loading"></span> Autenticando...`;
      }

      try {
        await loginAdmin(email, senha, manterConectado);
        mostrarToast('Autenticado com sucesso! Bem-vindo(a).', 'sucesso');
      } catch (err) {
        console.error("Falha na autenticação:", err);
        const msgAmigavel = traduzirErroAuth(err.code);
        mostrarToast(msgAmigavel, 'erro', 6000);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<span class="btn-login-texto">Entrar no Painel</span>`;
        }
      }
    });
  }

  // Mostrar / Ocultar Senha
  const btnToggleSenhaLogin = document.getElementById('btn-toggle-senha-login');
  const inputSenhaLogin = document.getElementById('login-senha');
  if (btnToggleSenhaLogin && inputSenhaLogin) {
    btnToggleSenhaLogin.addEventListener('click', () => {
      const tipoAtual = inputSenhaLogin.getAttribute('type');
      if (tipoAtual === 'password') {
        inputSenhaLogin.setAttribute('type', 'text');
        btnToggleSenhaLogin.textContent = '🔒';
      } else {
        inputSenhaLogin.setAttribute('type', 'password');
        btnToggleSenhaLogin.textContent = '👁️';
      }
    });
  }

  // Esqueci Minha Senha
  const btnEsqueciSenha = document.getElementById('btn-esqueci-senha');
  const modalRecuperar = document.getElementById('modal-recuperar-senha');
  const btnFecharModalRecuperar = document.getElementById('btn-fechar-modal-recuperar');
  const formRecuperar = document.getElementById('form-recuperar-senha');
  const btnSubmitRecuperar = document.getElementById('btn-submit-recuperar');

  if (btnEsqueciSenha && modalRecuperar) {
    btnEsqueciSenha.addEventListener('click', () => {
      const emailPreenchido = document.getElementById('login-email')?.value.trim() || '';
      const inputRecuperar = document.getElementById('recuperar-email');
      if (inputRecuperar && emailPreenchido) inputRecuperar.value = emailPreenchido;
      modalRecuperar.classList.add('ativo');
    });
  }

  if (btnFecharModalRecuperar && modalRecuperar) {
    btnFecharModalRecuperar.addEventListener('click', () => modalRecuperar.classList.remove('ativo'));
  }

  if (formRecuperar) {
    formRecuperar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('recuperar-email').value.trim();

      if (btnSubmitRecuperar) {
        btnSubmitRecuperar.disabled = true;
        btnSubmitRecuperar.innerHTML = `<span class="spinner-loading"></span> Enviando...`;
      }

      try {
        await recuperarSenha(email);
        mostrarToast('Link de redefinição enviado para seu e-mail! Verifique sua caixa de entrada e spam.', 'sucesso', 7000);
        modalRecuperar.classList.remove('ativo');
        formRecuperar.reset();
      } catch (err) {
        console.error("Erro na recuperação de senha:", err);
        mostrarToast(traduzirErroAuth(err.code), 'erro');
      } finally {
        if (btnSubmitRecuperar) {
          btnSubmitRecuperar.disabled = false;
          btnSubmitRecuperar.textContent = 'Enviar Link de Redefinição';
        }
      }
    });
  }

  // Logout Seguro
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await logoutAdmin();
        mostrarToast('Sessão encerrada com sucesso.', 'info');
      } catch (e) {
        console.error("Erro ao deslogar:", e);
      }
    });
  }

  // ========================================================================
  // 3. CARREGAMENTO DOS DADOS DO PAINEL (SOMENTE APÓS LOGIN)
  // ========================================================================
  function iniciarCarregamentoPainel() {
    configurarAbas();
    configurarSegurancaConta();

    // 1. Configurações em tempo real
    const unsubsConfig = assinarConfiguracoes((config) => {
      currentConfig = { ...CONFIG_PADRAO, ...config };
      preencherFormConfig(currentConfig);
      aplicarCoresCss(currentConfig.cores);
    });
    listenersAtivos.push(unsubsConfig);

    // 2. Categorias em tempo real
    const unsubsCat = assinarCategorias((categorias) => {
      currentCategorias = categorias || [];
      renderizarListaCategorias();
      atualizarSelectCategoriasProduto();
    });
    listenersAtivos.push(unsubsCat);

    // 3. Produtos em tempo real
    const unsubsProd = assinarProdutos((produtos) => {
      currentProdutos = produtos || [];
      renderizarListaProdutos();
    });
    listenersAtivos.push(unsubsProd);

    // 4. Pedidos em tempo real
    const unsubsPedidos = assinarPedidos((pedidos) => {
      if (totalPedidosAnterior !== null && pedidos.length > totalPedidosAnterior) {
        tocarAlertaSonoro();
        mostrarToast('🔔 NOVO PEDIDO RECEBIDO!', 'sucesso', 6000);
      }
      totalPedidosAnterior = pedidos.length;
      currentPedidos = pedidos || [];
      renderizarPedidos();
    });
    listenersAtivos.push(unsubsPedidos);

    // 5. Clientes em tempo real
    const unsubsCli = assinarClientes((clientes) => {
      currentClientes = clientes || [];
      renderizarClientes();
    });
    listenersAtivos.push(unsubsCli);

    configurarAcoesGerais();
  }

  function configurarAbas() {
    const abas = document.querySelectorAll('.admin-tab-btn');
    const conteudos = document.querySelectorAll('.admin-tab-content');

    abas.forEach(btn => {
      btn.addEventListener('click', () => {
        abas.forEach(b => b.classList.remove('ativo'));
        conteudos.forEach(c => c.classList.remove('ativo'));

        btn.classList.add('ativo');
        const targetId = btn.getAttribute('data-tab');
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('ativo');
      });
    });
  }

  function configurarSegurancaConta() {
    const inputNovaSenha = document.getElementById('alt-nova-senha');
    const barraPreenchimento = document.getElementById('forca-senha-preenchimento');
    const textoForca = document.getElementById('forca-senha-texto');

    if (inputNovaSenha && barraPreenchimento && textoForca) {
      inputNovaSenha.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!val) {
          barraPreenchimento.className = 'forca-senha-preenchimento';
          textoForca.textContent = 'Digite a nova senha para medir a segurança';
          textoForca.style.color = 'var(--text-muted)';
          return;
        }

        const validacao = validarForcaSenha(val);
        barraPreenchimento.className = `forca-senha-preenchimento ${validacao.forca}`;
        textoForca.textContent = validacao.mensagem;

        if (validacao.forca === 'forte') {
          textoForca.style.color = 'var(--green-open)';
        } else if (validacao.forca === 'media') {
          textoForca.style.color = 'var(--orange-terra)';
        } else {
          textoForca.style.color = 'var(--red-closed)';
        }
      });
    }

    const formAltSenha = document.getElementById('form-alterar-senha');
    const btnSubmitAltSenha = document.getElementById('btn-submit-alterar-senha');

    if (formAltSenha) {
      formAltSenha.addEventListener('submit', async (e) => {
        e.preventDefault();
        const senhaAtual = document.getElementById('alt-senha-atual').value;
        const novaSenha = document.getElementById('alt-nova-senha').value;
        const confirmaSenha = document.getElementById('alt-nova-senha-confirma').value;

        if (novaSenha !== confirmaSenha) {
          mostrarToast('A confirmação da nova senha não coincide.', 'alerta');
          return;
        }

        const validacao = validarForcaSenha(novaSenha);
        if (!validacao.valido) {
          mostrarToast(`Senha inválida: ${validacao.mensagem}`, 'alerta');
          return;
        }

        if (btnSubmitAltSenha) {
          btnSubmitAltSenha.disabled = true;
          btnSubmitAltSenha.textContent = 'Atualizando senha...';
        }

        try {
          await alterarSenhaAdmin(senhaAtual, novaSenha);
          mostrarToast('Senha atualizada com sucesso!', 'sucesso');
          formAltSenha.reset();
          if (barraPreenchimento) barraPreenchimento.className = 'forca-senha-preenchimento';
          if (textoForca) textoForca.textContent = 'Senha atualizada.';
        } catch (err) {
          console.error("Erro ao alterar senha:", err);
          mostrarToast(traduzirErroAuth(err.code || err.message), 'erro');
        } finally {
          if (btnSubmitAltSenha) {
            btnSubmitAltSenha.disabled = false;
            btnSubmitAltSenha.textContent = 'Atualizar Senha';
          }
        }
      });
    }

    const formAltEmail = document.getElementById('form-alterar-email');
    const btnSubmitAltEmail = document.getElementById('btn-submit-alterar-email');

    if (formAltEmail) {
      formAltEmail.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novoEmail = document.getElementById('alt-email-novo').value.trim();
        const senhaAtual = document.getElementById('alt-email-senha-atual').value;

        if (btnSubmitAltEmail) {
          btnSubmitAltEmail.disabled = true;
          btnSubmitAltEmail.textContent = 'Atualizando e-mail...';
        }

        try {
          await alterarEmailAdmin(senhaAtual, novoEmail);
          mostrarToast('E-mail atualizado com sucesso!', 'sucesso');
          const elEmailDisplay = document.getElementById('admin-user-email-display');
          if (elEmailDisplay) elEmailDisplay.textContent = novoEmail;
          formAltEmail.reset();
        } catch (err) {
          console.error("Erro ao alterar e-mail:", err);
          mostrarToast(traduzirErroAuth(err.code || err.message), 'erro');
        } finally {
          if (btnSubmitAltEmail) {
            btnSubmitAltEmail.disabled = false;
            btnSubmitAltEmail.textContent = 'Atualizar E-mail';
          }
        }
      });
    }
  }

  // ------------------------------------------------------------------------
  // SEÇÃO 1: CONFIGURAÇÕES GERAIS, LOJA E CORES
  // ------------------------------------------------------------------------
  function preencherFormConfig(cfg) {
    const elAberto = document.getElementById('cfg-loja-aberto-texto');
    const elIndicador = document.getElementById('cfg-loja-indicador');
    const btnToggleLoja = document.getElementById('btn-toggle-loja-status');

    if (cfg.aberto) {
      if (elAberto) elAberto.textContent = 'A LOJA ESTÁ ABERTA (Recebendo Pedidos)';
      if (elIndicador) elIndicador.className = 'loja-status-indicador aberto';
      if (btnToggleLoja) {
        btnToggleLoja.className = 'btn-toggle-loja fechar';
        btnToggleLoja.textContent = '🔒 Fechar Loja Agora';
      }
    } else {
      if (elAberto) elAberto.textContent = 'A LOJA ESTÁ FECHADA (Cardápio apenas visual)';
      if (elIndicador) elIndicador.className = 'loja-status-indicador fechado';
      if (btnToggleLoja) {
        btnToggleLoja.className = 'btn-toggle-loja abrir';
        btnToggleLoja.textContent = '🟢 Abrir Loja Agora';
      }
    }

    const inNome = document.getElementById('cfg-nome');
    const inSlogan = document.getElementById('cfg-slogan');
    const inWhats = document.getElementById('cfg-whatsapp');
    const inLocal = document.getElementById('cfg-local');
    const inModoDestaque = document.getElementById('cfg-modo-destaque');

    if (inNome) inNome.value = cfg.nome || '';
    if (inSlogan) inSlogan.value = cfg.slogan || '';
    if (inWhats) inWhats.value = cfg.whatsapp || '';
    if (inLocal) inLocal.value = cfg.local || '';
    if (inModoDestaque) inModoDestaque.value = cfg.modoDestaque || 'promocoes';

    const chkEntrega = document.getElementById('cfg-entrega-ativa');
    const chkRetirada = document.getElementById('cfg-retirada-ativa');
    const chkTaxa = document.getElementById('cfg-taxa-ativa');
    const inTaxaValor = document.getElementById('cfg-taxa-valor');
    const inMinimoEntrega = document.getElementById('cfg-minimo-entrega');

    if (chkEntrega) chkEntrega.checked = cfg.entregaAtiva !== false;
    if (chkRetirada) chkRetirada.checked = cfg.retiradaAtiva !== false;
    if (chkTaxa) chkTaxa.checked = cfg.taxaAtiva !== false;
    if (inTaxaValor) inTaxaValor.value = cfg.taxaValor || 0;
    if (inMinimoEntrega) inMinimoEntrega.value = cfg.minimoEntrega || 0;

    const cores = cfg.cores || CONFIG_PADRAO.cores;
    for (const chave in cores) {
      const inputCor = document.getElementById(`cor-${chave}`);
      const hexSpan = document.getElementById(`hex-${chave}`);
      if (inputCor) inputCor.value = cores[chave];
      if (hexSpan) hexSpan.textContent = cores[chave];
    }
  }

  function configurarAcoesGerais() {
    // Alternar Aberto / Fechado (BUG 1)
    const btnToggleLoja = document.getElementById('btn-toggle-loja-status');
    if (btnToggleLoja) {
      btnToggleLoja.onclick = async () => {
        const novoStatus = !currentConfig.aberto;
        try {
          await salvarConfiguracoes({ aberto: novoStatus });
          currentConfig.aberto = novoStatus;
          preencherFormConfig(currentConfig);
          mostrarToast(`Status alterado para: ${novoStatus ? 'ABERTO' : 'FECHADO'}!`, 'sucesso');
        } catch (e) {
          console.error("Erro ao alterar status da loja:", e);
          mostrarToast('Erro ao atualizar status da loja.', 'erro');
        }
      };
    }

    // Formulário de Configurações Gerais
    const formConfig = document.getElementById('form-config-gerais');
    if (formConfig) {
      formConfig.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
          nome: document.getElementById('cfg-nome').value.trim(),
          slogan: document.getElementById('cfg-slogan').value.trim(),
          whatsapp: document.getElementById('cfg-whatsapp').value.trim(),
          local: document.getElementById('cfg-local').value.trim(),
          modoDestaque: document.getElementById('cfg-modo-destaque').value,
          entregaAtiva: document.getElementById('cfg-entrega-ativa').checked,
          retiradaAtiva: document.getElementById('cfg-retirada-ativa').checked,
          taxaAtiva: document.getElementById('cfg-taxa-ativa').checked,
          taxaValor: parseFloat(document.getElementById('cfg-taxa-valor').value) || 0,
          minimoEntrega: parseFloat(document.getElementById('cfg-minimo-entrega').value) || 0
        };

        try {
          await salvarConfiguracoes(payload);
          mostrarToast('Configurações salvas com sucesso!', 'sucesso');
        } catch (err) {
          console.error("Erro ao salvar configurações:", err);
          mostrarToast('Erro ao salvar configurações.', 'erro');
        }
      };
    }

    // Formulário de Cores
    const formCores = document.getElementById('form-config-cores');
    if (formCores) {
      formCores.onsubmit = async (e) => {
        e.preventDefault();
        const novasCores = {
          primary: document.getElementById('cor-primary').value,
          primaryDark: document.getElementById('cor-primaryDark').value,
          bgCream: document.getElementById('cor-bgCream').value,
          cardCream: document.getElementById('cor-cardCream').value,
          greenOpen: document.getElementById('cor-greenOpen').value,
          yellowGold: document.getElementById('cor-yellowGold').value,
          orangeTerra: document.getElementById('cor-orangeTerra').value,
          textLight: document.getElementById('cor-textLight').value
        };

        try {
          await salvarConfiguracoes({ cores: novasCores });
          aplicarCoresCss(novasCores);
          mostrarToast('Paleta de cores salva com sucesso!', 'sucesso');
        } catch (err) {
          console.error("Erro ao salvar cores:", err);
          mostrarToast('Erro ao salvar cores.', 'erro');
        }
      };

      const colorPickers = formCores.querySelectorAll('.color-picker-input');
      colorPickers.forEach(picker => {
        picker.oninput = (e) => {
          const hexSpan = e.target.parentElement.querySelector('.color-hex');
          if (hexSpan) hexSpan.textContent = e.target.value;
          document.documentElement.style.setProperty(`--${e.target.id.replace('cor-', '')}`, e.target.value);
        };
      });

      const btnResetCores = document.getElementById('btn-resetar-cores');
      if (btnResetCores) {
        btnResetCores.onclick = async () => {
          try {
            await salvarConfiguracoes({ cores: CONFIG_PADRAO.cores });
            preencherFormConfig({ ...currentConfig, cores: CONFIG_PADRAO.cores });
            aplicarCoresCss(CONFIG_PADRAO.cores);
            mostrarToast('Cores restauradas para o padrão!', 'info');
          } catch (e) {
            console.error("Erro ao restaurar cores:", e);
            mostrarToast('Erro ao restaurar cores.', 'erro');
          }
        };
      }
    }

    configurarModais();
  }

  // ------------------------------------------------------------------------
  // SEÇÃO 2: CATEGORIAS (CRUD)
  // ------------------------------------------------------------------------
  function renderizarListaCategorias() {
    const tbody = document.getElementById('tabela-categorias-body');
    if (!tbody) return;

    if (currentCategorias.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">Nenhuma categoria cadastrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = currentCategorias.map((cat, idx) => `
      <tr>
        <td style="font-weight: 800;">#${cat.ordem || idx + 1}</td>
        <td><strong>${sanitizarTexto(cat.nome)}</strong></td>
        <td>
          <span class="badge-status ${cat.ativa !== false ? 'badge-ativo' : 'badge-inativo'}">
            ${cat.ativa !== false ? 'Ativa' : 'Oculta'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap: 0.4rem;">
            <button class="btn-acao-tabela btn-editar" onclick="window.adminService.abrirModalEditarCategoria('${cat.id}')" title="Editar">✏️</button>
            <button class="btn-acao-tabela btn-excluir" onclick="window.adminService.confirmarExcluirCategoria('${cat.id}', '${sanitizarTexto(cat.nome)}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function atualizarSelectCategoriasProduto() {
    const select = document.getElementById('prod-categoria');
    const selectFiltro = document.getElementById('filtro-prod-categoria');

    if (select) {
      select.innerHTML = '<option value="">Selecione uma categoria...</option>' + 
        currentCategorias.map(c => `<option value="${c.id}">${sanitizarTexto(c.nome)}</option>`).join('');
    }

    if (selectFiltro) {
      selectFiltro.innerHTML = '<option value="todas">Todas as categorias</option>' + 
        currentCategorias.map(c => `<option value="${c.id}">${sanitizarTexto(c.nome)}</option>`).join('');
    }
  }

  // ------------------------------------------------------------------------
  // SEÇÃO 3: PRODUTOS (CRUD)
  // ------------------------------------------------------------------------
  function renderizarListaProdutos() {
    const tbody = document.getElementById('tabela-produtos-body');
    if (!tbody) return;

    const termoBusca = (document.getElementById('busca-admin-produtos')?.value || '').toLowerCase().trim();
    const filtroCat = document.getElementById('filtro-prod-categoria')?.value || 'todas';

    let lista = currentProdutos;

    if (filtroCat !== 'todas') {
      lista = lista.filter(p => p.categoriaId === filtroCat);
    }

    if (termoBusca) {
      lista = lista.filter(p => (p.nome || '').toLowerCase().includes(termoBusca) || (p.descricao || '').toLowerCase().includes(termoBusca));
    }

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">Nenhum produto encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(p => {
      const cat = currentCategorias.find(c => c.id === p.categoriaId);
      const nomeCat = cat ? cat.nome : 'Sem categoria';
      const isPromo = p.precoPromo && parseFloat(p.precoPromo) > 0;

      return `
        <tr>
          <td>
            <img src="${p.foto || 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=200'}" alt="" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px;">
          </td>
          <td>
            <strong>${sanitizarTexto(p.nome)}</strong>
            ${p.destaque ? '<span class="tag-destaque" title="Produto em destaque">⭐ Destaque</span>' : ''}
            ${isPromo ? '<span class="tag-promo" title="Preço promocional ativo">🔥 Promo</span>' : ''}
            ${p.obs ? `<br><small style="color:#C0392B;">ℹ️ ${sanitizarTexto(p.obs)}</small>` : ''}
          </td>
          <td>${sanitizarTexto(nomeCat)}</td>
          <td>
            ${isPromo ? `<small style="text-decoration:line-through; color:#888;">${formatarMoeda(p.preco)}</small><br><strong>${formatarMoeda(p.precoPromo)}</strong>` : `<strong>${formatarMoeda(p.preco)}</strong>`}
          </td>
          <td>
            <span class="badge-status ${p.disponivel !== false ? 'badge-ativo' : 'badge-inativo'}">
              ${p.disponivel !== false ? 'Disponível' : 'Esgotado'}
            </span>
          </td>
          <td>
            <div style="display:flex; gap: 0.4rem;">
              <button class="btn-acao-tabela btn-editar" onclick="window.adminService.abrirModalEditarProduto('${p.id}')" title="Editar">✏️</button>
              <button class="btn-acao-tabela btn-excluir" onclick="window.adminService.confirmarExcluirProduto('${p.id}', '${sanitizarTexto(p.nome)}')" title="Excluir">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ------------------------------------------------------------------------
  // SEÇÃO 4: PEDIDOS EM TEMPO REAL
  // ------------------------------------------------------------------------
  function renderizarPedidos() {
    const container = document.getElementById('grid-pedidos-admin');
    const badgeNovos = document.getElementById('badge-pedidos-novos-count');
    if (!container) return;

    const pedidosNovos = currentPedidos.filter(p => p.status === 'Novo');
    if (badgeNovos) {
      badgeNovos.textContent = pedidosNovos.length;
      badgeNovos.style.display = pedidosNovos.length > 0 ? 'inline-block' : 'none';
    }

    if (currentPedidos.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 3rem; background: #fff; border-radius: 14px;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📦</div>
          <p style="font-weight: 800; font-size: 1.1rem;">Nenhum pedido recebido ainda.</p>
          <p style="color: #666;">Assim que um cliente enviar pelo cardápio, ele aparecerá aqui com aviso sonoro!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = currentPedidos.map(pedido => {
      const dataFormatada = pedido.criadoEm ? new Date(pedido.criadoEm).toLocaleString('pt-BR') : 'Data não informada';
      const statusClass = (pedido.status || 'Novo').replace(/\s+/g, '-');
      const telClienteLimpo = limparTelefone(pedido.cliente?.telefone || '');

      return `
        <div class="pedido-card status-${statusClass}" data-id="${pedido.id}">
          <div class="pedido-card-header">
            <span class="pedido-numero">Pedido #${pedido.numero || pedido.id.substring(0, 5)}</span>
            <span class="pedido-hora">${dataFormatada}</span>
          </div>

          <div class="pedido-cliente-bloco">
            <strong>👤 ${sanitizarTexto(pedido.cliente?.nome || 'Cliente')}</strong><br>
            📱 ${sanitizarTexto(pedido.cliente?.telefone || '')}<br>
            📍 <strong>Tipo:</strong> ${pedido.tipo === 'entrega' ? '🛵 Entrega' : '🛍️ Retirada na Praça da quadra'}<br>
            ${pedido.tipo === 'entrega' ? `🏠 <strong>Endereço:</strong> ${sanitizarTexto(pedido.cliente?.endereco || '')}<br>` : ''}
            ${pedido.cliente?.referencia ? `🎯 <strong>Ref:</strong> ${sanitizarTexto(pedido.cliente.referencia)}<br>` : ''}
            💳 <strong>Pagamento:</strong> ${pedido.pagamento?.forma === 'dinheiro' ? `Dinheiro (Troco: ${pedido.pagamento.trocoPara ? formatarMoeda(pedido.pagamento.trocoPara) : 'Não'})` : pedido.pagamento?.forma === 'pix' ? 'Pix' : 'Cartão na entrega'}
          </div>

          <div class="pedido-itens-lista">
            ${(pedido.itens || []).map(it => `
              <div class="pedido-item-row">
                <span><strong>${it.quantidade}x</strong> ${sanitizarTexto(it.nome)} ${it.observacao ? `<br><small>↳ _${sanitizarTexto(it.observacao)}_</small>` : ''}</span>
                <span>${formatarMoeda(it.precoUnit * it.quantidade)}</span>
              </div>
            `).join('')}
          </div>

          <div class="pedido-rodape-total">
            <span>Total:</span>
            <span>${formatarMoeda(pedido.total)}</span>
          </div>

          <div class="pedido-status-controle" style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.4rem;">
            <label style="font-size:0.8rem; font-weight:800;">Status do Pedido:</label>
            <select class="form-select" onchange="window.adminService.mudarStatusPedido('${pedido.id}', this.value)" style="font-weight:700;">
              <option value="Novo" ${pedido.status === 'Novo' ? 'selected' : ''}>🟡 Novo</option>
              <option value="Em preparo" ${pedido.status === 'Em preparo' ? 'selected' : ''}>🔵 Em preparo</option>
              <option value="Saiu para entrega" ${pedido.status === 'Saiu para entrega' ? 'selected' : ''}>🟣 Saiu para entrega / Pronto</option>
              <option value="Entregue" ${pedido.status === 'Entregue' ? 'selected' : ''}>🟢 Entregue / Finalizado</option>
              <option value="Cancelado" ${pedido.status === 'Cancelado' ? 'selected' : ''}>🔴 Cancelado</option>
            </select>
          </div>

          <div class="pedido-acoes">
            ${telClienteLimpo ? `
              <a href="https://wa.me/55${telClienteLimpo}?text=Ol%C3%A1%20${encodeURIComponent(pedido.cliente?.nome || '')}!%20Estamos%20entrando%20em%20contato%20sobre%20o%20seu%20pedido%20%23${pedido.numero}%20na%20Lanchonete%20Casa%20Branca." target="_blank" class="btn-chamar-whats">
                💬 Conversar no WhatsApp
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ------------------------------------------------------------------------
  // SEÇÃO 5: CLIENTES & EXPORTAÇÃO CSV
  // ------------------------------------------------------------------------
  function renderizarClientes() {
    const tbody = document.getElementById('tabela-clientes-body');
    const badgeTotal = document.getElementById('badge-total-clientes');
    if (!tbody) return;

    if (badgeTotal) badgeTotal.textContent = currentClientes.length;

    const termoBusca = (document.getElementById('busca-admin-clientes')?.value || '').toLowerCase().trim();
    let lista = currentClientes;

    if (termoBusca) {
      lista = lista.filter(c => (c.nome || '').toLowerCase().includes(termoBusca) || (c.telefone || '').includes(termoBusca) || (c.endereco || '').toLowerCase().includes(termoBusca));
    }

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhum cliente cadastrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(c => `
      <tr>
        <td><strong>${sanitizarTexto(c.nome)}</strong></td>
        <td>${sanitizarTexto(c.telefone)}</td>
        <td>${sanitizarTexto(c.endereco || 'Retirada')}</td>
        <td>${sanitizarTexto(c.referencia || '-')}</td>
        <td>
          <a href="https://wa.me/55${limparTelefone(c.telefone)}" target="_blank" class="btn-acao-tabela" style="background:#25D366; color:#fff;" title="Chamar no WhatsApp">💬</a>
        </td>
      </tr>
    `).join('');
  }

  function exportarClientesCsv() {
    if (currentClientes.length === 0) {
      mostrarToast('Nenhum cliente para exportar.', 'alerta');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Nome,Telefone,Endereço,Ponto de Referência,Data de Cadastro\n";

    currentClientes.forEach(c => {
      const linha = [
        `"${(c.nome || '').replace(/"/g, '""')}"`,
        `"${(c.telefone || '').replace(/"/g, '""')}"`,
        `"${(c.endereco || '').replace(/"/g, '""')}"`,
        `"${(c.referencia || '').replace(/"/g, '""')}"`,
        `"${(c.criadoEm || c.atualizadoEm || '')}"`
      ].join(",");
      csvContent += linha + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clientes_casa_branca_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    mostrarToast('Exportação de clientes concluída com sucesso!', 'sucesso');
  }

  function exportarPedidosCsv() {
    if (currentPedidos.length === 0) {
      mostrarToast('Nenhum pedido para exportar.', 'alerta');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Numero,Data/Hora,Cliente,Telefone,Tipo,Subtotal,Taxa,Total,Pagamento,Status,Itens\n";

    currentPedidos.forEach(p => {
      const itensResumo = (p.itens || []).map(i => `${i.quantidade}x ${i.nome}`).join(" | ");
      const linha = [
        `"#${p.numero || ''}"`,
        `"${p.criadoEm || ''}"`,
        `"${(p.cliente?.nome || '').replace(/"/g, '""')}"`,
        `"${(p.cliente?.telefone || '').replace(/"/g, '""')}"`,
        `"${p.tipo || ''}"`,
        `"${p.subtotal || 0}"`,
        `"${p.taxa || 0}"`,
        `"${p.total || 0}"`,
        `"${p.pagamento?.forma || ''}"`,
        `"${p.status || ''}"`,
        `"${itensResumo.replace(/"/g, '""')}"`
      ].join(",");
      csvContent += linha + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pedidos_casa_branca_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    mostrarToast('Exportação de pedidos concluída com sucesso!', 'sucesso');
  }

  // ------------------------------------------------------------------------
  // MODAIS DE CRIAÇÃO E EDIÇÃO (PRODUTOS E CATEGORIAS)
  // ------------------------------------------------------------------------
  function configurarModais() {
    document.getElementById('busca-admin-produtos')?.addEventListener('input', renderListaProdutosDebounce);
    document.getElementById('filtro-prod-categoria')?.addEventListener('change', renderizarListaProdutos);
    document.getElementById('busca-admin-clientes')?.addEventListener('input', renderClientesDebounce);

    document.getElementById('btn-exportar-clientes')?.addEventListener('click', exportarClientesCsv);
    document.getElementById('btn-exportar-pedidos')?.addEventListener('click', exportarPedidosCsv);

    // Modal Categoria (BUG 2)
    const modalCat = document.getElementById('modal-admin-categoria');
    const formCat = document.getElementById('form-modal-categoria');
    const btnNovaCat = document.getElementById('btn-nova-categoria');
    const btnFecharCat = document.getElementById('btn-fechar-modal-cat');

    if (btnNovaCat) {
      btnNovaCat.onclick = () => {
        document.getElementById('modal-cat-id').value = '';
        document.getElementById('cat-nome').value = '';
        document.getElementById('cat-ordem').value = currentCategorias.length + 1;
        document.getElementById('cat-ativa').checked = true;
        document.getElementById('modal-cat-titulo').textContent = 'Nova Categoria';
        modalCat.classList.add('ativo');
      };
    }

    if (btnFecharCat) {
      btnFecharCat.onclick = () => modalCat.classList.remove('ativo');
    }

    if (formCat) {
      formCat.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('modal-cat-id').value;
        const nomeValor = document.getElementById('cat-nome').value.trim();

        if (!nomeValor) {
          mostrarToast('Por favor, digite o nome da categoria.', 'alerta');
          return;
        }

        const categoriaData = {
          nome: nomeValor,
          ordem: parseInt(document.getElementById('cat-ordem').value) || 1,
          ativa: document.getElementById('cat-ativa').checked
        };

        try {
          await salvarCategoria(categoriaData, id || null);
          modalCat.classList.remove('ativo');
          mostrarToast(id ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!', 'sucesso');
        } catch (err) {
          console.error("Erro ao salvar categoria:", err);
          mostrarToast('Erro ao salvar categoria.', 'erro');
        }
      };
    }

    // Modal Produto
    const modalProd = document.getElementById('modal-admin-produto');
    const formProd = document.getElementById('form-modal-produto');
    const btnNovoProd = document.getElementById('btn-novo-produto');
    const btnFecharProd = document.getElementById('btn-fechar-modal-prod');

    if (btnNovoProd) {
      btnNovoProd.onclick = () => {
        document.getElementById('modal-prod-id').value = '';
        formProd.reset();
        document.getElementById('prod-disponivel').checked = true;
        document.getElementById('modal-prod-titulo').textContent = 'Novo Produto';
        modalProd.classList.add('ativo');
      };
    }

    if (btnFecharProd) {
      btnFecharProd.onclick = () => modalProd.classList.remove('ativo');
    }

    if (formProd) {
      formProd.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('modal-prod-id').value;
        const precoPromoValor = document.getElementById('prod-preco-promo').value;
        const nomeProd = document.getElementById('prod-nome').value.trim();

        if (!nomeProd) {
          mostrarToast('Por favor, informe o nome do produto.', 'alerta');
          return;
        }

        const precoNormal = parseFloat(document.getElementById('prod-preco').value) || 0;
        const precoPromo = precoPromoValor ? parseFloat(precoPromoValor) : null;

        if (precoPromo !== null && precoPromo >= precoNormal) {
          mostrarToast('Atenção: O preço promocional deve ser menor que o preço normal.', 'alerta');
          return;
        }

        const categoriaId = document.getElementById('prod-categoria').value;
        if (!categoriaId) {
          mostrarToast('Selecione uma categoria para o produto.', 'alerta');
          return;
        }

        const produtoData = {
          nome: nomeProd,
          descricao: document.getElementById('prod-descricao').value.trim(),
          preco: precoNormal,
          precoPromo: precoPromo,
          categoriaId: categoriaId,
          foto: document.getElementById('prod-foto').value.trim(),
          obs: document.getElementById('prod-obs').value.trim(),
          disponivel: document.getElementById('prod-disponivel').checked,
          destaque: document.getElementById('prod-destaque').checked
        };

        try {
          await salvarProduto(produtoData, id || null);
          modalProd.classList.remove('ativo');
          mostrarToast(id ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!', 'sucesso');
        } catch (err) {
          console.error("Erro ao salvar produto:", err);
          mostrarToast('Erro ao salvar produto.', 'erro');
        }
      };
    }
  }

  let debounceProdTimer = null;
  function renderListaProdutosDebounce() {
    clearTimeout(debounceProdTimer);
    debounceProdTimer = setTimeout(renderizarListaProdutos, 250);
  }

  let debounceCliTimer = null;
  function renderClientesDebounce() {
    clearTimeout(debounceCliTimer);
    debounceCliTimer = setTimeout(renderizarClientes, 250);
  }

  // ------------------------------------------------------------------------
  // FUNÇÕES GLOBAIS ONCLICK EXPOSTAS EM WINDOW
  // ------------------------------------------------------------------------
  window.adminService = {
    abrirModalEditarCategoria: (id) => {
      const cat = currentCategorias.find(c => c.id === id);
      if (!cat) return;
      document.getElementById('modal-cat-id').value = cat.id;
      document.getElementById('cat-nome').value = cat.nome || '';
      document.getElementById('cat-ordem').value = cat.ordem || 1;
      document.getElementById('cat-ativa').checked = cat.ativa !== false;
      document.getElementById('modal-cat-titulo').textContent = 'Editar Categoria';
      document.getElementById('modal-admin-categoria').classList.add('ativo');
    },

    confirmarExcluirCategoria: async (id, nome) => {
      if (confirm(`Tem certeza que deseja excluir a categoria "${nome}"?`)) {
        try {
          await excluirCategoria(id);
          mostrarToast(`Categoria "${nome}" excluída com sucesso.`, 'sucesso');
        } catch (e) {
          console.error("Erro ao excluir categoria:", e);
          mostrarToast('Erro ao excluir categoria.', 'erro');
        }
      }
    },

    abrirModalEditarProduto: (id) => {
      const prod = currentProdutos.find(p => p.id === id);
      if (!prod) return;
      document.getElementById('modal-prod-id').value = prod.id;
      document.getElementById('prod-nome').value = prod.nome || '';
      document.getElementById('prod-descricao').value = prod.descricao || '';
      document.getElementById('prod-preco').value = prod.preco || 0;
      document.getElementById('prod-preco-promo').value = prod.precoPromo || '';
      document.getElementById('prod-categoria').value = prod.categoriaId || '';
      document.getElementById('prod-foto').value = prod.foto || '';
      document.getElementById('prod-obs').value = prod.obs || '';
      document.getElementById('prod-disponivel').checked = prod.disponivel !== false;
      document.getElementById('prod-destaque').checked = !!prod.destaque;
      document.getElementById('modal-prod-titulo').textContent = 'Editar Produto';
      document.getElementById('modal-admin-produto').classList.add('ativo');
    },

    confirmarExcluirProduto: async (id, nome) => {
      if (confirm(`Tem certeza que deseja excluir o produto "${nome}"?`)) {
        try {
          await excluirProduto(id);
          mostrarToast(`Produto "${nome}" excluído com sucesso.`, 'sucesso');
        } catch (e) {
          console.error("Erro ao excluir produto:", e);
          mostrarToast('Erro ao excluir produto.', 'erro');
        }
      }
    },

    mudarStatusPedido: async (id, novoStatus) => {
      try {
        await atualizarStatusPedido(id, novoStatus);
        mostrarToast(`Status do pedido atualizado para "${novoStatus}"!`, 'sucesso');
      } catch (e) {
        console.error("Erro ao atualizar status do pedido:", e);
        mostrarToast('Erro ao atualizar status do pedido.', 'erro');
      }
    }
  };
});
