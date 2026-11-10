// ==========================================================================
// Módulo do Carrinho de Compras e Finalização de Pedidos
// ==========================================================================

import { formatarMoeda, mostrarToast, sanitizarTexto, limparTelefone, mascaraTelefone } from "./utils.js";
import { salvarCliente, buscarClientePorTelefone, criarPedido } from "./firebase-service.js";
import { normalizarTelefoneWhatsApp } from "../notificacoes.js";

class CarrinhoService {
  constructor() {
    this.itens = []; // { produto, quantidade, observacao }
    this.config = null;
    this.tipoEntrega = 'entrega'; // 'entrega' ou 'retirada'
    this.formaPagamento = 'pix'; // 'pix', 'dinheiro', 'cartao'
    this.trocoPara = '';
    this.obsGeral = '';
    this.pedidoEmEnvio = false;
    this.cliente = {
      nome: '',
      telefone: '',
      endereco: '',
      referencia: ''
    };

    this.carregarCacheLocalStorage();
  }

  carregarCacheLocalStorage() {
    try {
      const salvo = localStorage.getItem('casa_branca_carrinho');
      if (salvo) {
        this.itens = JSON.parse(salvo);
      }
      const clienteSalvo = localStorage.getItem('casa_branca_cliente');
      if (clienteSalvo) {
        this.cliente = JSON.parse(clienteSalvo);
      }
    } catch (e) {
      console.warn("Falha ao ler cache local:", e);
    }
  }

  salvarCacheLocalStorage() {
    try {
      localStorage.setItem('casa_branca_carrinho', JSON.stringify(this.itens));
      localStorage.setItem('casa_branca_cliente', JSON.stringify(this.cliente));
    } catch (e) {
      console.warn("Falha ao salvar cache local:", e);
    }
  }

  setConfig(config) {
    this.config = config;
    // Se a entrega foi desativada e a retirada ativa, migra para retirada automaticamente
    if (this.config && !this.config.entregaAtiva && this.config.retiradaAtiva) {
      this.tipoEntrega = 'retirada';
    }
    this.atualizarInterface();
  }

  sincronizarProdutosOnline(produtos) {
    const produtosPorId = new Map();
    produtos.forEach((produto) => {
      produtosPorId.set(produto.id, produto);
      if (produto.idLegado) produtosPorId.set(produto.idLegado, produto);
    });

    let removidos = 0;
    this.itens = this.itens.reduce((itensAtuais, item) => {
      const produtoAtual = produtosPorId.get(item.produto.id);
      if (!produtoAtual || produtoAtual.disponivel === false) {
        removidos++;
        return itensAtuais;
      }
      itensAtuais.push({ ...item, produto: produtoAtual });
      return itensAtuais;
    }, []);

    this.salvarCacheLocalStorage();
    this.atualizarInterface();
    if (removidos) mostrarToast('Itens indisponíveis ou removidos foram retirados da sacola após atualizar o cardápio.', 'alerta', 7000);
  }

  adicionarItem(produto, quantidade = 1, observacao = '') {
    if (!produto || !produto.disponivel) {
      mostrarToast('Desculpe, este produto está indisponível no momento.', 'alerta');
      return;
    }

    const index = this.itens.findIndex(item => item.produto.id === produto.id);
    if (index > -1) {
      this.itens[index].quantidade += quantidade;
      if (observacao) {
        this.itens[index].observacao = observacao;
      }
    } else {
      this.itens.push({
        produto,
        quantidade,
        observacao
      });
    }

    this.salvarCacheLocalStorage();
    this.atualizarInterface();
    mostrarToast(`"${produto.nome}" adicionado à sacola!`, 'sucesso');
  }

  removerItem(produtoId) {
    this.itens = this.itens.filter(item => item.produto.id !== produtoId);
    this.salvarCacheLocalStorage();
    this.atualizarInterface();
  }

  alterarQuantidade(produtoId, delta) {
    const item = this.itens.find(it => it.produto.id === produtoId);
    if (!item) return;

    item.quantidade += delta;
    if (item.quantidade <= 0) {
      this.removerItem(produtoId);
      return;
    }

    this.salvarCacheLocalStorage();
    this.atualizarInterface();
  }

  atualizarObsItem(produtoId, obs) {
    const item = this.itens.find(it => it.produto.id === produtoId);
    if (item) {
      item.observacao = obs;
      this.salvarCacheLocalStorage();
    }
  }

  limparCarrinho() {
    this.itens = [];
    this.obsGeral = '';
    this.trocoPara = '';
    this.salvarCacheLocalStorage();
    this.atualizarInterface();
  }

  getSubtotal() {
    return this.itens.reduce((acc, item) => {
      const precoEfetivo = item.produto.precoPromo || item.produto.preco || 0;
      return acc + (precoEfetivo * item.quantidade);
    }, 0);
  }

  getTaxaEntrega() {
    if (this.tipoEntrega === 'retirada') return 0;
    if (!this.config || !this.config.taxaAtiva) return 0;
    return parseFloat(this.config.taxaValor) || 0;
  }

  getTotal() {
    return this.getSubtotal() + this.getTaxaEntrega();
  }

  getQuantidadeTotalItens() {
    return this.itens.reduce((acc, item) => acc + item.quantidade, 0);
  }

  // Atualiza os componentes visuais do carrinho flutuante e do modal
  atualizarInterface() {
    const badgeCount = document.getElementById('cart-badge-count');
    const badgeTotal = document.getElementById('cart-badge-total');
    const floatBtn = document.getElementById('cart-float-btn');

    const totalQtd = this.getQuantidadeTotalItens();
    const subtotal = this.getSubtotal();

    if (badgeCount) badgeCount.textContent = totalQtd;
    if (badgeTotal) badgeTotal.textContent = formatarMoeda(subtotal);

    if (floatBtn) {
      if (totalQtd > 0) {
        floatBtn.classList.add('visible');
        floatBtn.classList.add('pulse-anim');
        setTimeout(() => floatBtn.classList.remove('pulse-anim'), 600);
      } else {
        floatBtn.classList.remove('visible');
      }
    }

    this.renderizarModalCarrinho();
  }

  renderizarModalCarrinho() {
    const containerItens = document.getElementById('cart-items-container');
    const elSubtotal = document.getElementById('cart-subtotal');
    const elTaxa = document.getElementById('cart-taxa');
    const elTotal = document.getElementById('cart-total');
    const elMinimoAviso = document.getElementById('cart-minimo-aviso');
    const elBtnFinalizar = document.getElementById('btn-finalizar-pedido');
    const rowEndereco = document.getElementById('grupo-endereco');

    if (!containerItens) return;

    if (this.itens.length === 0) {
      containerItens.innerHTML = `
        <div class="cart-vazio">
          <div class="cart-vazio-icone">🛒</div>
          <p class="cart-vazio-titulo">Sua sacola está vazia</p>
          <p class="cart-vazio-sub">Escolha os lanches e salgados mais gostosos no nosso cardápio!</p>
        </div>
      `;
      if (elSubtotal) elSubtotal.textContent = formatarMoeda(0);
      if (elTaxa) elTaxa.textContent = formatarMoeda(0);
      if (elTotal) elTotal.textContent = formatarMoeda(0);
      if (elMinimoAviso) elMinimoAviso.style.display = 'none';
      if (elBtnFinalizar) elBtnFinalizar.disabled = true;
      return;
    }

    // Renderiza lista de itens
    containerItens.innerHTML = this.itens.map(item => {
      const precoUnit = item.produto.precoPromo || item.produto.preco;
      const totalItem = precoUnit * item.quantidade;
      return `
        <div class="cart-item-card">
          <div class="cart-item-info">
            <span class="cart-item-nome">${sanitizarTexto(item.produto.nome)}</span>
            <span class="cart-item-preco-un">${formatarMoeda(precoUnit)} cada</span>
            <input 
              type="text" 
              class="cart-item-obs-input" 
              placeholder="Obs do item (ex: sem cebola)" 
              value="${sanitizarTexto(item.observacao || '')}"
              onchange="window.carrinhoService.atualizarObsItem('${item.produto.id}', this.value)"
            />
          </div>
          <div class="cart-item-acoes">
            <div class="qty-controle">
              <button class="btn-qty" onclick="window.carrinhoService.alterarQuantidade('${item.produto.id}', -1)" aria-label="Diminuir">-</button>
              <span class="qty-valor">${item.quantidade}</span>
              <button class="btn-qty" onclick="window.carrinhoService.alterarQuantidade('${item.produto.id}', 1)" aria-label="Aumentar">+</button>
            </div>
            <div class="cart-item-total">${formatarMoeda(totalItem)}</div>
            <button class="btn-item-remover" onclick="window.carrinhoService.removerItem('${item.produto.id}')" title="Remover item">🗑</button>
          </div>
        </div>
      `;
    }).join('');

    const subtotal = this.getSubtotal();
    const taxa = this.getTaxaEntrega();
    const total = this.getTotal();

    if (elSubtotal) elSubtotal.textContent = formatarMoeda(subtotal);
    if (elTaxa) {
      if (this.tipoEntrega === 'retirada') {
        elTaxa.textContent = 'Grátis (Retirada)';
      } else if (!this.config || !this.config.taxaAtiva) {
        elTaxa.textContent = 'Grátis';
      } else {
        elTaxa.textContent = formatarMoeda(taxa);
      }
    }
    if (elTotal) elTotal.textContent = formatarMoeda(total);

    // Controle de exibição do endereço de acordo com o tipo (Entrega vs Retirada)
    if (rowEndereco) {
      if (this.tipoEntrega === 'retirada') {
        rowEndereco.style.display = 'none';
      } else {
        rowEndereco.style.display = 'block';
      }
    }

    // Validação de valor mínimo de entrega
    let bloqueadoPorMinimo = false;
    const minimo = (this.config && this.config.minimoEntrega) ? parseFloat(this.config.minimoEntrega) : 0;

    if (this.tipoEntrega === 'entrega' && minimo > 0 && subtotal < minimo) {
      bloqueadoPorMinimo = true;
      const faltam = minimo - subtotal;
      if (elMinimoAviso) {
        elMinimoAviso.style.display = 'block';
        elMinimoAviso.innerHTML = `⚠️ Pedido mínimo para entrega é de <strong>${formatarMoeda(minimo)}</strong>. Faltam <strong>${formatarMoeda(faltam)}</strong>.`;
      }
    } else {
      if (elMinimoAviso) elMinimoAviso.style.display = 'none';
    }

    // Validação loja fechada
    const lojaFechada = this.config && !this.config.aberto;

    if (elBtnFinalizar) {
      elBtnFinalizar.disabled = this.pedidoEmEnvio || bloqueadoPorMinimo || lojaFechada || this.itens.length === 0;
    }
  }

  async confirmarPedido() {
    if (this.pedidoEmEnvio) {
      mostrarToast('Seu pedido já está sendo enviado. Aguarde a confirmação.', 'info');
      return;
    }

    // 1. Validação de loja aberta
    if (this.config && !this.config.aberto) {
      mostrarToast('A lanchonete está fechada no momento. Não é possível enviar pedidos.', 'erro');
      return;
    }
    if (!normalizarTelefoneWhatsApp(this.config?.whatsapp)) {
      mostrarToast('O contato do WhatsApp da lanchonete está ausente ou inválido nas configurações do banco.', 'erro', 7000);
      return;
    }

    // 2. Validação de itens
    if (this.itens.length === 0) {
      mostrarToast('Sua sacola está vazia!', 'alerta');
      return;
    }

    // 3. Validação de dados do cliente
    const inputNome = document.getElementById('cli-nome');
    const inputTel = document.getElementById('cli-telefone');
    const inputEnd = document.getElementById('cli-endereco');
    const inputRef = document.getElementById('cli-referencia');
    const inputObsGeral = document.getElementById('cart-obs-geral');
    const inputTroco = document.getElementById('pag-troco-valor');

    const nome = inputNome ? inputNome.value.trim() : this.cliente.nome;
    const tel = inputTel ? inputTel.value.trim() : this.cliente.telefone;
    const end = inputEnd ? inputEnd.value.trim() : this.cliente.endereco;
    const refCli = inputRef ? inputRef.value.trim() : this.cliente.referencia;
    this.obsGeral = inputObsGeral ? inputObsGeral.value.trim() : '';
    this.trocoPara = inputTroco ? inputTroco.value.trim() : '';
    if (this.formaPagamento === 'dinheiro' && this.trocoPara) {
      // Aceita "50", "50,00" ou "1.050,50" e guarda como número (as regras exigem número)
      const bruto = this.trocoPara.replace(/[^\d.,]/g, '');
      const normalizado = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
      const valor = parseFloat(normalizado);
      if (!Number.isFinite(valor) || valor <= 0) {
        mostrarToast('Informe um valor válido para o troco (ex: 50,00) ou deixe em branco.', 'alerta');
        if (inputTroco) inputTroco.focus();
        return;
      }
      this.trocoPara = valor;
    } else {
      this.trocoPara = '';
    }

    if (!nome) {
      mostrarToast('Por favor, informe seu nome.', 'alerta');
      if (inputNome) inputNome.focus();
      return;
    }

    const telLimpo = limparTelefone(tel);
    if (!telLimpo || telLimpo.length < 10) {
      mostrarToast('Por favor, informe um telefone válido com DDD (ex: 74 99999-9999).', 'alerta');
      if (inputTel) inputTel.focus();
      return;
    }

    if (this.tipoEntrega === 'entrega' && !end) {
      mostrarToast('Para entregas, informe seu endereço completo com rua e número.', 'alerta');
      if (inputEnd) inputEnd.focus();
      return;
    }

    // 4. Validação do mínimo
    const subtotal = this.getSubtotal();
    const minimo = (this.config && this.config.minimoEntrega) ? parseFloat(this.config.minimoEntrega) : 0;
    if (this.tipoEntrega === 'entrega' && minimo > 0 && subtotal < minimo) {
      const faltam = minimo - subtotal;
      mostrarToast(`Valor mínimo para entrega é ${formatarMoeda(minimo)}. Faltam ${formatarMoeda(faltam)}.`, 'alerta');
      return;
    }

    this.pedidoEmEnvio = true;
    const btnFinalizar = document.getElementById('btn-finalizar-pedido');
    if (btnFinalizar) btnFinalizar.disabled = true;

    let pedidoCriado;
    let numeroPedido;
    try {
      this.cliente = { nome, telefone: tel, endereco: end, referencia: refCli };
      this.salvarCacheLocalStorage();

      try {
        await salvarCliente(this.cliente);
      } catch (erroCliente) {
        if (String(erroCliente.code || erroCliente.message).toUpperCase().includes('PERMISSION_DENIED')) {
          // Cliente recorrente: o cadastro já existe e só o admin pode alterá-lo. Não é um erro para o cliente.
          console.info('Cadastro do cliente já existe; mantido sem alterações.');
        } else {
          console.error('Não foi possível salvar o cadastro do cliente no Firebase:', erroCliente);
          mostrarToast(`Cadastro não sincronizado: ${erroCliente.message}. O pedido ainda será tentado.`, 'alerta', 7000);
        }
      }

      const pedidoPayload = {
        cliente: this.cliente,
        itens: this.itens.map((item) => ({
          id: item.produto.id || '',
          nome: item.produto.nome,
          quantidade: item.quantidade,
          precoUnit: item.produto.precoPromo || item.produto.preco,
          observacao: item.observacao || ''
        })),
        tipo: this.tipoEntrega,
        subtotal: this.getSubtotal(),
        taxa: this.getTaxaEntrega(),
        total: this.getTotal(),
        pagamento: {
          forma: this.formaPagamento,
          trocoPara: this.formaPagamento === 'dinheiro' && this.trocoPara ? this.trocoPara : null
        },
        observacaoGeral: this.obsGeral
      };

      pedidoCriado = await criarPedido(pedidoPayload);
      numeroPedido = pedidoCriado.numero;
    } catch (erro) {
      console.error('Não foi possível registrar o pedido no Firebase:', erro);
      mostrarToast(`Pedido não registrado. O carrinho foi mantido. Verifique a conexão e tente novamente. ${erro.message}`, 'erro', 9000);
      return;
    } finally {
      this.pedidoEmEnvio = false;
      this.atualizarInterface();
    }

    // 7. Monta mensagem amigável e estruturada para WhatsApp
    const linkAcompanhamento = pedidoCriado?.id
      ? `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}acompanhar.html?pedido=${encodeURIComponent(pedidoCriado.id)}`
      : '';
    const msgWhatsApp = this.montarMensagemWhatsApp(numeroPedido, linkAcompanhamento);
    const whatsappNum = normalizarTelefoneWhatsApp(this.config.whatsapp);
    const linkZap = `https://wa.me/${whatsappNum}?text=${encodeURIComponent(msgWhatsApp)}`;

    // 8. Limpa o carrinho e fecha modal
    this.limparCarrinho();
    const modal = document.getElementById('modal-carrinho');
    if (modal) modal.classList.remove('ativo');
    document.body.style.overflow = '';

    mostrarToast('Pedido enviado com sucesso! Abrindo o WhatsApp...', 'sucesso', 4000);

    // 9. Redireciona para o WhatsApp
    setTimeout(() => {
      window.open(linkZap, '_blank', 'noopener');
      if (pedidoCriado?.id) window.location.assign(linkAcompanhamento);
    }, 400);
  }

  montarMensagemWhatsApp(numeroPedido, linkAcompanhamento = '') {
    const nomeLanchonete = this.config?.nome || 'Lanchonete';
    const localRetirada = this.config?.local || 'local de retirada';
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    let msg = `🏡 *PEDIDO #${numeroPedido} - ${nomeLanchonete}*\n`;
    msg += `🕒 _${horaAgora}_\n`;
    msg += `------------------------------------\n`;
    msg += `👤 *Cliente:* ${this.cliente.nome}\n`;
    msg += `📱 *Telefone:* ${this.cliente.telefone}\n`;
    msg += `📍 *Tipo:* ${this.tipoEntrega === 'entrega' ? '🛵 ENTREGA' : '🛍️ RETIRADA NO LOCAL'}\n`;

    if (this.tipoEntrega === 'entrega') {
      msg += `🏠 *Endereço:* ${this.cliente.endereco}\n`;
      if (this.cliente.referencia) {
        msg += `🎯 *Ponto de Ref.:* ${this.cliente.referencia}\n`;
      }
    } else {
      msg += `📍 *Retirar em:* ${localRetirada}\n`;
    }

    msg += `------------------------------------\n`;
    msg += `📋 *ITENS DO PEDIDO:*\n`;

    this.itens.forEach(it => {
      const precoUnit = it.produto.precoPromo || it.produto.preco;
      const totalItem = precoUnit * it.quantidade;
      msg += `• *${it.quantidade}x* ${it.produto.nome} (${formatarMoeda(totalItem)})\n`;
      if (it.observacao) {
        msg += `   ↳ _Obs: ${it.observacao}_\n`;
      }
    });

    msg += `------------------------------------\n`;
    msg += `💰 *Subtotal:* ${formatarMoeda(this.getSubtotal())}\n`;
    if (this.tipoEntrega === 'entrega') {
      const taxa = this.getTaxaEntrega();
      msg += `🛵 *Taxa de Entrega:* ${taxa > 0 ? formatarMoeda(taxa) : 'Grátis'}\n`;
    }
    msg += `💳 *TOTAL:* ${formatarMoeda(this.getTotal())}\n`;

    let textoPag = 'Pix';
    if (this.formaPagamento === 'dinheiro') {
      textoPag = 'Dinheiro';
      if (this.trocoPara) {
        textoPag += ` (Troco para ${formatarMoeda(this.trocoPara)})`;
      } else {
        textoPag += ' (Não precisa de troco)';
      }
    } else if (this.formaPagamento === 'cartao') {
      textoPag = 'Cartão (Levar maquininha)';
    }
    msg += `💵 *Forma de Pagamento:* ${textoPag}\n`;

    if (this.obsGeral) {
      msg += `💬 *Observações:* ${this.obsGeral}\n`;
    }

    msg += `------------------------------------\n`;
    if (linkAcompanhamento) msg += `📲 *Acompanhe seu pedido:* ${linkAcompanhamento}\n`;
    msg += `_Obrigado pela preferência! "${this.config?.slogan || ''}"_`;

    return msg;
  }
}

export const carrinhoService = new CarrinhoService();
window.carrinhoService = carrinhoService;
