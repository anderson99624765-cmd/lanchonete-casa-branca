// ==========================================================================
// Lanchonete Casa Branca - Controlador da Área do Cliente
// ==========================================================================

import { 
  assinarConfiguracoes, 
  assinarCategorias, 
  assinarProdutos, 
  assinarPedidoPublico,
  atualizarPedidoRecente,
  obterPedidosRecentes,
  assinarConexaoFirebase,
  buscarClientePorTelefone,
} from "./modules/firebase-service.js";
import { carrinhoService } from "./modules/carrinho.js";
import { CardapioView } from "./modules/cardapio.js";
import { normalizarTelefoneWhatsApp } from "./notificacoes.js";
import { aplicarCoresCss, mascaraTelefone, limparTelefone, mostrarToast } from "./modules/utils.js";

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Inicializando Lanchonete Casa Branca...");

  const cardapioView = new CardapioView();
  window.cardapioView = cardapioView;

  let currentConfig = null;
  let currentCategorias = [];
  let currentProdutos = [];
  const listeners = [];
  const elEstadoBanco = document.getElementById('app-database-status');
  const errosLeitura = new Map();
  let bancoConectado = false;

  function atualizarAvisoBanco() {
    if (!elEstadoBanco) return;
    elEstadoBanco.hidden = bancoConectado && errosLeitura.size === 0;
    if (!bancoConectado) {
      elEstadoBanco.textContent = '🔴 Sem conexão com o banco de dados. O cardápio será exibido assim que a conexão voltar.';
    } else if (errosLeitura.size) {
      const detalhes = [...errosLeitura.entries()].map(([fonte, erro]) => `${fonte}: ${erro}`).join('; ');
      elEstadoBanco.textContent = `🟠 Conectado ao Firebase, mas há dados indisponíveis: ${detalhes}`;
    } else {
      elEstadoBanco.textContent = '';
    }
  }

  function registrarErroLeitura(fonte, erro) {
    console.error(`Não foi possível ler ${fonte} do Firebase:`, erro);
    errosLeitura.set(fonte, erro.message || 'erro desconhecido');
    atualizarAvisoBanco();
    if (fonte === 'configurações') {
      const seloLoja = document.getElementById('selo-status-loja');
      const textoSelo = document.getElementById('selo-status-texto');
      if (seloLoja) seloLoja.className = 'selo-status-loja fechado';
      if (textoSelo) textoSelo.textContent = 'Dados da loja indisponíveis';
    }
    if (currentProdutos.length === 0 && cardapioView.elGridProdutos) {
      cardapioView.elGridProdutos.textContent = 'Cardápio indisponível. Verifique a conexão e tente novamente.';
    }
  }

  configurarBannerAcompanhamento();

  listeners.push(assinarConexaoFirebase((conectado) => {
    bancoConectado = conectado;
    if (!conectado && !currentConfig) {
      const seloLoja = document.getElementById('selo-status-loja');
      const textoSelo = document.getElementById('selo-status-texto');
      if (seloLoja) seloLoja.className = 'selo-status-loja fechado';
      if (textoSelo) textoSelo.textContent = 'Banco indisponível';
      if (currentProdutos.length === 0 && cardapioView.elGridProdutos) {
        cardapioView.elGridProdutos.textContent = 'Cardápio indisponível. Verifique a conexão e tente novamente.';
      }
    }
    atualizarAvisoBanco();
  }));

  // 2. Listener das Configurações do Site em tempo real
  listeners.push(assinarConfiguracoes((config) => {
    if (!config) return;
    errosLeitura.delete('configurações');
    atualizarAvisoBanco();
    currentConfig = config;
    atualizarCabecalhoETextos(currentConfig);
    aplicarCoresCss(currentConfig.cores);
    carrinhoService.setConfig(currentConfig);
    cardapioView.setDados(currentCategorias, currentProdutos, currentConfig);
  }, (erro) => {
    registrarErroLeitura('configurações', erro);
  }));

  // 3. Listener das Categorias em tempo real
  listeners.push(assinarCategorias((categorias) => {
    errosLeitura.delete('categorias');
    atualizarAvisoBanco();
    currentCategorias = categorias || [];
    if (currentConfig) cardapioView.setDados(currentCategorias, currentProdutos, currentConfig);
  }, (erro) => {
    registrarErroLeitura('categorias', erro);
  }));

  // 4. Listener dos Produtos em tempo real
  listeners.push(assinarProdutos((produtos) => {
    errosLeitura.delete('produtos');
    atualizarAvisoBanco();
    currentProdutos = produtos || [];
    carrinhoService.sincronizarProdutosOnline(currentProdutos);
    if (currentConfig) cardapioView.setDados(currentCategorias, currentProdutos, currentConfig);
  }, (erro) => {
    registrarErroLeitura('produtos', erro);
  }));

  // 5. Configuração dos Eventos da UI (Carrinho, Modais, Cadastro)
  configurarEventosUI();
  window.addEventListener('pagehide', () => listeners.forEach((unsubscribe) => unsubscribe()), { once: true });

  function configurarBannerAcompanhamento() {
    const recentes = obterPedidosRecentes();
    if (!recentes.length) return;

    const banner = document.createElement('a');
    banner.id = 'acompanhamento-banner';
    banner.className = 'acompanhamento-banner';
    banner.hidden = true;
    document.body.append(banner);

    const pedidosAtivos = new Map();
    const atualizarBanner = () => {
      const ativo = recentes.find((item) => {
        const pedido = pedidosAtivos.get(item.id);
        return pedido && !['Entregue', 'Retirado', 'Cancelado'].includes(pedido.status);
      });
      if (!ativo) {
        banner.hidden = true;
        return;
      }
      const pedido = pedidosAtivos.get(ativo.id);
      banner.href = `acompanhar.html?pedido=${encodeURIComponent(ativo.id)}`;
      banner.textContent = `Acompanhar pedido #${pedido.numero || ativo.numero} · ${pedido.status || 'Recebido'}`;
      banner.hidden = false;
      atualizarPedidoRecente(pedido);
    };

    recentes.forEach((recente) => {
      const unsubscribe = assinarPedidoPublico(recente.id, (pedido) => {
        if (pedido) pedidosAtivos.set(recente.id, pedido);
        atualizarBanner();
      });
      window.addEventListener('pagehide', unsubscribe, { once: true });
    });
  }

  function atualizarCabecalhoETextos(config) {
    const elNome = document.getElementById('loja-nome');
    const elSlogan = document.getElementById('loja-slogan');
    const elLocal = document.getElementById('loja-local-texto');
    const elWhats = document.getElementById('loja-whats-link');
    const elWhatsTexto = document.getElementById('loja-whats-texto');
    const numeroWhatsApp = normalizarTelefoneWhatsApp(config.whatsapp);
    const elSelo = document.getElementById('selo-status-loja');
    const elSeloTexto = document.getElementById('selo-status-texto');
    const elAvisoFechado = document.getElementById('aviso-loja-fechada');

    if (elNome) elNome.textContent = config.nome || '';
    if (elSlogan) elSlogan.textContent = config.slogan || '';
    if (elLocal) elLocal.textContent = config.local || '';

    if (elWhats && elWhatsTexto && numeroWhatsApp) {
      const tel = config.whatsappFormatado || config.whatsapp;
      elWhatsTexto.textContent = tel;
      elWhats.href = `https://wa.me/${numeroWhatsApp}`;
      elWhats.hidden = false;
    } else if (elWhats) {
      elWhats.hidden = true;
      elWhats.removeAttribute('href');
    }

    const nomeFooter = document.getElementById('loja-nome-footer');
    const sloganFooter = document.getElementById('loja-slogan-footer');
    const localFooter = document.getElementById('loja-local-footer');
    const whatsFooter = document.getElementById('loja-whats-footer');
    const localRetirada = document.getElementById('retirada-local-mini');
    if (nomeFooter) nomeFooter.textContent = config.nome || '';
    if (sloganFooter) sloganFooter.textContent = config.slogan || '';
    if (localFooter) localFooter.textContent = config.local || '';
    if (whatsFooter) whatsFooter.textContent = config.whatsappFormatado || config.whatsapp || '';
    if (localRetirada) localRetirada.textContent = config.local ? `(${config.local})` : '';

    // Status Aberto ou Fechado
    if (config.aberto) {
      if (elSelo) {
        elSelo.className = 'selo-status-loja aberto';
      }
      if (elSeloTexto) elSeloTexto.textContent = 'Aberto agora';
      if (elAvisoFechado) elAvisoFechado.style.display = 'none';
    } else {
      if (elSelo) {
        elSelo.className = 'selo-status-loja fechado';
      }
      if (elSeloTexto) elSeloTexto.textContent = 'Fechado';
      if (elAvisoFechado) {
        elAvisoFechado.style.display = 'block';
        elAvisoFechado.textContent = 'Estamos fechados no momento. Você pode conferir nosso cardápio, mas pedidos estão temporariamente pausados.';
      }
    }
  }

  function configurarEventosUI() {
    // Abertura e fechamento do modal do carrinho
    const btnFloat = document.getElementById('cart-float-btn');
    const modalCarrinho = document.getElementById('modal-carrinho');
    const btnFecharModal = document.getElementById('btn-fechar-modal-carrinho');

    if (modalCarrinho) {
      let focoAnterior = null;
      const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

      const abrirCarrinho = () => {
        focoAnterior = document.activeElement;
        modalCarrinho.classList.add('ativo');
        document.body.style.overflow = 'hidden';
        if (btnFecharModal) btnFecharModal.focus();
      };

      const fecharCarrinho = () => {
        modalCarrinho.classList.remove('ativo');
        document.body.style.overflow = '';
        if (focoAnterior && typeof focoAnterior.focus === 'function') focoAnterior.focus();
      };

      if (btnFloat) btnFloat.addEventListener('click', abrirCarrinho);
      if (btnFecharModal) btnFecharModal.addEventListener('click', fecharCarrinho);
      modalCarrinho.addEventListener('click', (e) => {
        if (e.target === modalCarrinho) fecharCarrinho();
      });

      // Esc fecha a sacola e o Tab fica preso dentro dela enquanto estiver aberta
      document.addEventListener('keydown', (e) => {
        if (!modalCarrinho.classList.contains('ativo')) return;
        if (e.key === 'Escape') {
          fecharCarrinho();
          return;
        }
        if (e.key !== 'Tab') return;
        const focaveis = [...modalCarrinho.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
        if (!focaveis.length) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      });
    }

    // Seletor Entrega vs Retirada
    const btnEntrega = document.getElementById('btn-opt-entrega');
    const btnRetirada = document.getElementById('btn-opt-retirada');

    if (btnEntrega && btnRetirada) {
      btnEntrega.addEventListener('click', () => {
        if (currentConfig && !currentConfig.entregaAtiva) {
          mostrarToast('A opção de Entrega está temporariamente desativada pela lanchonete.', 'alerta');
          return;
        }
        carrinhoService.tipoEntrega = 'entrega';
        btnEntrega.classList.add('ativo');
        btnRetirada.classList.remove('ativo');
        carrinhoService.atualizarInterface();
      });

      btnRetirada.addEventListener('click', () => {
        if (currentConfig && !currentConfig.retiradaAtiva) {
          mostrarToast('A opção de Retirada está desativada pela lanchonete.', 'alerta');
          return;
        }
        carrinhoService.tipoEntrega = 'retirada';
        btnRetirada.classList.add('ativo');
        btnEntrega.classList.remove('ativo');
        carrinhoService.atualizarInterface();
      });
    }

    // Seletor de Forma de Pagamento
    const botoesPag = document.querySelectorAll('.btn-pag-opcao');
    const blocoTroco = document.getElementById('bloco-troco');

    botoesPag.forEach(btn => {
      btn.addEventListener('click', () => {
        botoesPag.forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        const forma = btn.getAttribute('data-pag');
        carrinhoService.formaPagamento = forma;

        if (blocoTroco) {
          if (forma === 'dinheiro') {
            blocoTroco.style.display = 'block';
          } else {
            blocoTroco.style.display = 'none';
          }
        }
      });
    });

    // Máscara e Reconhecimento Automático de Cliente pelo Telefone
    const inputTel = document.getElementById('cli-telefone');
    const inputNome = document.getElementById('cli-nome');
    const inputEnd = document.getElementById('cli-endereco');
    const inputRef = document.getElementById('cli-referencia');
    const badgeCliente = document.getElementById('badge-cliente-reconhecido');

    if (carrinhoService.cliente) {
      if (inputNome && carrinhoService.cliente.nome) inputNome.value = carrinhoService.cliente.nome;
      if (inputTel && carrinhoService.cliente.telefone) inputTel.value = mascaraTelefone(carrinhoService.cliente.telefone);
      if (inputEnd && carrinhoService.cliente.endereco) inputEnd.value = carrinhoService.cliente.endereco;
      if (inputRef && carrinhoService.cliente.referencia) inputRef.value = carrinhoService.cliente.referencia;
    }

    if (inputTel) {
      inputTel.addEventListener('input', async (e) => {
        e.target.value = mascaraTelefone(e.target.value);
        const telLimpo = limparTelefone(e.target.value);

        if (telLimpo.length >= 10) {
          try {
            const clienteCadastrado = await buscarClientePorTelefone(telLimpo);
            if (clienteCadastrado) {
              if (inputNome && !inputNome.value) inputNome.value = clienteCadastrado.nome || '';
              if (inputEnd && !inputEnd.value) inputEnd.value = clienteCadastrado.endereco || '';
              if (inputRef && !inputRef.value) inputRef.value = clienteCadastrado.referencia || '';

              if (badgeCliente) {
                badgeCliente.style.display = 'inline-block';
                badgeCliente.textContent = `Olá de novo, ${clienteCadastrado.nome.split(' ')[0]}!`;
              }
              mostrarToast(`Bem-vindo(a) de volta, ${clienteCadastrado.nome.split(' ')[0]}!`, 'info');
            }
            } catch (err) {
            console.error("Falha na consulta de cliente no Firebase:", err);
            mostrarToast('Não foi possível consultar os dados do cliente no banco. Tente novamente.', 'erro');
          }
        }
      });
    }

    // Botão de Finalizar Pedido
    const btnFinalizar = document.getElementById('btn-finalizar-pedido');
    if (btnFinalizar) {
      btnFinalizar.addEventListener('click', () => {
        carrinhoService.confirmarPedido();
      });
    }
  }
});
