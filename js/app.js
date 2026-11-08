// ==========================================================================
// Lanchonete Casa Branca - Controlador da Área do Cliente
// ==========================================================================

import { 
  assinarConfiguracoes, 
  assinarCategorias, 
  assinarProdutos, 
  buscarClientePorTelefone,
  verificarEExecutarSeed,
  conexaoValida 
} from "./modules/firebase-service.js";
import { CONFIG_PADRAO } from "./modules/firebase-config.js";
import { carrinhoService } from "./modules/carrinho.js";
import { CardapioView } from "./modules/cardapio.js";
import { aplicarCoresCss, mascaraTelefone, limparTelefone, mostrarToast } from "./modules/utils.js";

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Inicializando Lanchonete Casa Branca...");

  const cardapioView = new CardapioView();
  window.cardapioView = cardapioView;

  let currentConfig = CONFIG_PADRAO;
  let currentCategorias = [];
  let currentProdutos = [];

  // 1. Executa seed de inicialização
  await verificarEExecutarSeed();

  // 2. Listener das Configurações do Site em tempo real
  assinarConfiguracoes((config) => {
    currentConfig = { ...CONFIG_PADRAO, ...config };
    atualizarCabecalhoETextos(currentConfig);
    aplicarCoresCss(currentConfig.cores);
    carrinhoService.setConfig(currentConfig);
    cardapioView.setDados(currentCategorias, currentProdutos, currentConfig);
  });

  // 3. Listener das Categorias em tempo real
  assinarCategorias((categorias) => {
    currentCategorias = categorias || [];
    cardapioView.setDados(currentCategorias, currentProdutos, currentConfig);
  });

  // 4. Listener dos Produtos em tempo real
  assinarProdutos((produtos) => {
    currentProdutos = produtos || [];
    cardapioView.setDados(currentCategorias, currentProdutos, currentConfig);
  });

  // 5. Configuração dos Eventos da UI (Carrinho, Modais, Cadastro)
  configurarEventosUI();

  function atualizarCabecalhoETextos(config) {
    const elNome = document.getElementById('loja-nome');
    const elSlogan = document.getElementById('loja-slogan');
    const elLocal = document.getElementById('loja-local-texto');
    const elWhats = document.getElementById('loja-whats-link');
    const elWhatsTexto = document.getElementById('loja-whats-texto');
    const elSelo = document.getElementById('selo-status-loja');
    const elSeloTexto = document.getElementById('selo-status-texto');
    const elAvisoFechado = document.getElementById('aviso-loja-fechada');

    if (elNome) elNome.textContent = config.nome || "Lanchonete Casa Branca";
    if (elSlogan) elSlogan.textContent = config.slogan || "O sabor que faz você se sentir em casa.";
    if (elLocal) elLocal.textContent = config.local || "Praça da quadra";

    if (elWhats && elWhatsTexto) {
      const tel = config.whatsappFormatado || config.whatsapp || "(74) 99917-7156";
      elWhatsTexto.textContent = tel;
      elWhats.href = `https://wa.me/55${limparTelefone(config.whatsapp || "74999177156")}`;
    }

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

    if (btnFloat && modalCarrinho) {
      btnFloat.addEventListener('click', () => {
        modalCarrinho.classList.add('ativo');
        document.body.style.overflow = 'hidden';
      });
    }

    if (btnFecharModal && modalCarrinho) {
      btnFecharModal.addEventListener('click', () => {
        modalCarrinho.classList.remove('ativo');
        document.body.style.overflow = '';
      });

      modalCarrinho.addEventListener('click', (e) => {
        if (e.target === modalCarrinho) {
          modalCarrinho.classList.remove('ativo');
          document.body.style.overflow = '';
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
            console.warn("Consulta de cliente:", err);
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
