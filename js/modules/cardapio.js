// ==========================================================================
// Módulo do Cardápio - Renderização Dinâmica e Filtros
// ==========================================================================

import { formatarMoeda, sanitizarTexto } from "./utils.js";
import { carrinhoService } from "./carrinho.js";

export class CardapioView {
  constructor() {
    this.produtos = [];
    this.categorias = [];
    this.categoriaAtiva = 'todas';
    this.modoDestaque = 'promocoes'; // 'promocoes' ou 'destaques'
    this.buscaTexto = '';

    this.elNavCategorias = document.getElementById('nav-categorias-lista');
    this.elGridProdutos = document.getElementById('grid-produtos');
    this.elBuscaInput = document.getElementById('busca-cardapio');
    
    this.initListeners();
  }

  initListeners() {
    if (this.elBuscaInput) {
      this.elBuscaInput.addEventListener('input', (e) => {
        this.buscaTexto = e.target.value.toLowerCase().trim();
        this.renderizarProdutos();
      });
    }
  }

  setDados(categorias, produtos, config) {
    this.produtos = produtos || [];
    
    // Filtra apenas categorias ativas E que tenham ao menos 1 produto cadastrado
    this.categorias = (categorias || []).filter(c => {
      if (c.ativa === false) return false;
      const temItens = this.produtos.some(p => p.categoriaId === c.id);
      return temItens;
    });

    if (config) {
      this.modoDestaque = config.modoDestaque || 'promocoes';
    }
    this.renderizarBarraCategorias();
    this.renderizarProdutos();
  }

  renderizarBarraCategorias() {
    if (!this.elNavCategorias) return;

    // Verifica se existem produtos em destaque/promoção
    const temDestaques = this.produtos.some(p => p.destaque || (p.precoPromo && p.precoPromo > 0));
    const nomeDestaqueSecao = this.modoDestaque === 'promocoes' ? '🔥 Promoções' : '⭐ Destaques';

    let html = `
      <button 
        class="cat-chip ${this.categoriaAtiva === 'todas' ? 'ativo' : ''}" 
        data-cat-id="todas"
        onclick="window.cardapioView.selecionarCategoria('todas')"
      >
        🍽️ Ver Tudo
      </button>
    `;

    if (temDestaques) {
      html += `
        <button 
          class="cat-chip chip-destaque ${this.categoriaAtiva === 'destaques' ? 'ativo' : ''}" 
          data-cat-id="destaques"
          onclick="window.cardapioView.selecionarCategoria('destaques')"
        >
          ${nomeDestaqueSecao}
        </button>
      `;
    }

    this.categorias.forEach(cat => {
      const ativaClass = this.categoriaAtiva === cat.id ? 'ativo' : '';
      html += `
        <button 
          class="cat-chip ${ativaClass}" 
          data-cat-id="${cat.id}"
          onclick="window.cardapioView.selecionarCategoria('${cat.id}')"
        >
          ${sanitizarTexto(cat.nome)}
        </button>
      `;
    });

    this.elNavCategorias.innerHTML = html;
  }

  selecionarCategoria(catId) {
    this.categoriaAtiva = catId;
    this.renderizarBarraCategorias();
    this.renderizarProdutos();

    // Rola suavemente até o cardápio
    const elCardapio = document.getElementById('secao-cardapio');
    if (elCardapio) {
      const topo = elCardapio.getBoundingClientRect().top + window.pageYOffset - 120;
      window.scrollTo({ top: topo, behavior: 'smooth' });
    }
  }

  renderizarProdutos() {
    if (!this.elGridProdutos) return;

    // Filtra por categoria
    let filtrados = this.produtos;

    if (this.categoriaAtiva === 'destaques') {
      filtrados = filtrados.filter(p => p.destaque || (p.precoPromo && p.precoPromo > 0));
    } else if (this.categoriaAtiva !== 'todas') {
      filtrados = filtrados.filter(p => p.categoriaId === this.categoriaAtiva);
    }

    // Filtra por busca
    if (this.buscaTexto) {
      filtrados = filtrados.filter(p => {
        const nome = (p.nome || '').toLowerCase();
        const desc = (p.descricao || '').toLowerCase();
        const obs = (p.obs || '').toLowerCase();
        return nome.includes(this.buscaTexto) || desc.includes(this.buscaTexto) || obs.includes(this.buscaTexto);
      });
    }

    if (filtrados.length === 0) {
      this.elGridProdutos.innerHTML = `
        <div class="cardapio-vazio">
          <span class="cardapio-vazio-icone">🔍</span>
          <h3>Nenhum item encontrado</h3>
          <p>Tente buscar por outro termo ou escolha outra categoria acima.</p>
        </div>
      `;
      return;
    }

    // Agrupamento por categorias para uma hierarquia visual limpa e apetitosa
    if (this.categoriaAtiva === 'todas' && !this.buscaTexto) {
      this.renderizarAgrupadoPorCategorias(filtrados);
    } else {
      this.renderizarCardsDiretos(filtrados);
    }
  }

  renderizarAgrupadoPorCategorias(lista) {
    const temDestaques = lista.some(p => p.destaque || (p.precoPromo && p.precoPromo > 0));
    const nomeDestaqueSecao = this.modoDestaque === 'promocoes' ? '🔥 Promoções Especiais' : '⭐ Destaques da Casa';

    let html = '';

    // 1. Seção Destaques sempre no topo (se houver itens)
    if (temDestaques) {
      const itensDestaque = lista.filter(p => p.destaque || (p.precoPromo && p.precoPromo > 0));
      html += `
        <div class="categoria-bloco">
          <div class="categoria-titulo-wrapper">
            <h2 class="categoria-titulo">${nomeDestaqueSecao}</h2>
            <span class="pincelada-decorativa"></span>
          </div>
          <div class="cards-grid">
            ${itensDestaque.map(p => this.gerarCardProdutoHtml(p)).join('')}
          </div>
        </div>
      `;
    }

    // 2. Seções das demais categorias (apenas as que têm itens)
    this.categorias.forEach(cat => {
      const itensCat = lista.filter(p => p.categoriaId === cat.id);
      if (itensCat.length > 0) {
        html += `
          <div class="categoria-bloco" id="cat-bloco-${cat.id}">
            <div class="categoria-titulo-wrapper">
              <h2 class="categoria-titulo">${sanitizarTexto(cat.nome)}</h2>
              <span class="pincelada-decorativa"></span>
            </div>
            <div class="cards-grid">
              ${itensCat.map(p => this.gerarCardProdutoHtml(p)).join('')}
            </div>
          </div>
        `;
      }
    });

    this.elGridProdutos.innerHTML = html;
  }

  renderizarCardsDiretos(lista) {
    let titulo = 'Itens Selecionados';
    if (this.categoriaAtiva === 'destaques') {
      titulo = this.modoDestaque === 'promocoes' ? '🔥 Promoções Especiais' : '⭐ Destaques da Casa';
    } else {
      const cat = this.categorias.find(c => c.id === this.categoriaAtiva);
      if (cat) titulo = cat.nome;
    }

    if (this.buscaTexto) {
      titulo = `Resultados para "${sanitizarTexto(this.buscaTexto)}"`;
    }

    const html = `
      <div class="categoria-bloco">
        <div class="categoria-titulo-wrapper">
          <h2 class="categoria-titulo">${sanitizarTexto(titulo)}</h2>
          <span class="pincelada-decorativa"></span>
        </div>
        <div class="cards-grid">
          ${lista.map(p => this.gerarCardProdutoHtml(p)).join('')}
        </div>
      </div>
    `;

    this.elGridProdutos.innerHTML = html;
  }

  gerarCardProdutoHtml(prod) {
    const isPromo = prod.precoPromo && parseFloat(prod.precoPromo) > 0 && parseFloat(prod.precoPromo) < parseFloat(prod.preco);
    const precoExibicao = isPromo ? prod.precoPromo : prod.preco;
    const isEsgotado = prod.disponivel === false;

    // Foto padrão aconchegante caso o produto não tenha foto cadastrada
    const fotoUrl = prod.foto || 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80';

    return `
      <article class="produto-card ${isEsgotado ? 'esgotado' : ''}" data-produto-id="${prod.id}">
        <div class="produto-img-container">
          <img 
            src="${sanitizarTexto(fotoUrl)}" 
            alt="${sanitizarTexto(prod.nome)}" 
            loading="lazy" 
            class="produto-img"
            onerror="this.src='https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80'"
          />
          ${isPromo ? '<span class="badge-promo">PROMO</span>' : ''}
          ${prod.destaque && !isPromo ? '<span class="badge-destaque">⭐ Favorito</span>' : ''}
          ${isEsgotado ? '<div class="badge-esgotado-overlay"><span>ESGOTADO</span></div>' : ''}
        </div>

        <div class="produto-conteudo">
          <header class="produto-header">
            <h3 class="produto-nome">${sanitizarTexto(prod.nome)}</h3>
          </header>

          ${prod.descricao ? `<p class="produto-desc">${sanitizarTexto(prod.descricao)}</p>` : ''}
          
          ${prod.obs ? `
            <div class="produto-aviso-obs">
              <span class="aviso-icone">ℹ️</span>
              <span class="aviso-texto">${sanitizarTexto(prod.obs)}</span>
            </div>
          ` : ''}

          <div class="produto-rodape">
            <div class="produto-precos">
              ${isPromo ? `<span class="preco-antigo">${formatarMoeda(prod.preco)}</span>` : ''}
              <span class="preco-atual ${isPromo ? 'preco-destaque' : ''}">${formatarMoeda(precoExibicao)}</span>
            </div>

            <button 
              type="button" 
              class="btn-adicionar ${isEsgotado ? 'btn-desabilitado' : ''}" 
              ${isEsgotado ? 'disabled' : ''}
              onclick="window.cardapioView.adicionarAoCarrinho('${prod.id}')"
              aria-label="Adicionar ${sanitizarTexto(prod.nome)} à sacola"
            >
              ${isEsgotado ? 'Esgotado' : '<span class="btn-icone">+</span> Adicionar'}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  adicionarAoCarrinho(produtoId) {
    const prod = this.produtos.find(p => p.id === produtoId);
    if (prod) {
      carrinhoService.adicionarItem(prod, 1);
    }
  }
}
