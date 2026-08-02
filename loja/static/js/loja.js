/**
 * CHICOPLUG — comportamento da loja.
 *
 * JavaScript sem framework. As páginas são renderizadas pelo Django; isto trata
 * apenas do que exige interacção: tema, menu, pesquisa, carrinho e favoritos.
 */
(function () {
  "use strict";

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  /** Lê o token CSRF do cookie que o Django emite. */
  function csrf() {
    const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  async function pedir(url, dados) {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "X-CSRFToken": csrf(), "X-Requested-With": "XMLHttpRequest" },
      body: dados,
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.mensagem || "Algo correu mal.");
    return corpo;
  }

  // ── Avisos ────────────────────────────────────────────────────────────────

  function avisar(mensagem, tipo = "ok") {
    const caixa = $("#avisos");
    if (!caixa) return;

    const aviso = document.createElement("div");
    aviso.className =
      "border bg-background px-5 py-4 text-sm shadow-lg transition-all duration-300 " +
      (tipo === "erro" ? "border-destructive text-destructive" : "border-border");
    aviso.textContent = mensagem;
    aviso.style.opacity = "0";
    aviso.style.transform = "translateY(8px)";
    caixa.appendChild(aviso);

    requestAnimationFrame(() => {
      aviso.style.opacity = "1";
      aviso.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      aviso.style.opacity = "0";
      setTimeout(() => aviso.remove(), 300);
    }, 4000);
  }

  // ── Tema ──────────────────────────────────────────────────────────────────
  //
  // O tema já foi aplicado pelo script inline no <head>, antes da primeira
  // pintura. Aqui só tratamos do alternador e de manter os ícones coerentes.

  function sincronizarIcones() {
    const escuro = document.documentElement.classList.contains("dark");
    $$("[data-icone-lua]").forEach((el) => el.classList.toggle("hidden", escuro));
    $$("[data-icone-sol]").forEach((el) => el.classList.toggle("hidden", !escuro));
  }

  function iniciarTema() {
    sincronizarIcones();

    $$("[data-tema]").forEach((botao) =>
      botao.addEventListener("click", () => {
        const escuro = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", escuro);
        document.documentElement.style.colorScheme = escuro ? "dark" : "light";
        try {
          localStorage.setItem("cp-tema", escuro ? "escuro" : "claro");
        } catch (e) {
          /* modo privado: o tema vale só para esta sessão */
        }
        sincronizarIcones();
      })
    );

    // Acompanha o sistema enquanto o utilizador não escolher explicitamente.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (ev) => {
      let guardado = null;
      try {
        guardado = localStorage.getItem("cp-tema");
      } catch (e) {}
      if (guardado && guardado !== "sistema") return;
      document.documentElement.classList.toggle("dark", ev.matches);
      sincronizarIcones();
    });
  }

  // ── Navbar, menu e pesquisa ───────────────────────────────────────────────

  function iniciarNavegacao() {
    const barra = $("[data-navbar]");
    if (barra) {
      const aoRolar = () => {
        const rolou = window.scrollY > 24;
        barra.classList.toggle("border-border", rolou);
        barra.classList.toggle("border-transparent", !rolou);
        barra.classList.toggle("bg-background/92", rolou);
        barra.classList.toggle("backdrop-blur-xl", rolou);
      };
      window.addEventListener("scroll", aoRolar, { passive: true });
      aoRolar();
    }

    const menu = $("[data-menu-mobile]");
    $$("[data-abrir-menu]").forEach((b) =>
      b.addEventListener("click", () => menu && menu.classList.remove("hidden"))
    );
    $$("[data-fechar-menu]").forEach((b) =>
      b.addEventListener("click", () => menu && menu.classList.add("hidden"))
    );

    const painel = $("[data-painel-pesquisa]");
    $$("[data-abrir-pesquisa]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!painel) return;
        painel.classList.toggle("hidden");
        if (!painel.classList.contains("hidden")) $("[data-campo-pesquisa]", painel)?.focus();
      })
    );

    const mega = $("[data-mega-menu]");
    if (mega && barra) {
      $$("[data-mega]").forEach((link) =>
        link.addEventListener("mouseenter", () => mega.classList.remove("hidden"))
      );
      barra.addEventListener("mouseleave", () => mega.classList.add("hidden"));
    }

    iniciarSugestoes();
  }

  /** Sugestões de pesquisa, com atraso para não disparar a cada tecla. */
  function iniciarSugestoes() {
    const campo = $("[data-campo-pesquisa]");
    const caixa = $("[data-sugestoes]");
    if (!campo || !caixa) return;

    let temporizador;
    let pedidoActual;

    campo.addEventListener("input", () => {
      clearTimeout(temporizador);
      const termo = campo.value.trim();

      if (termo.length < 2) {
        caixa.classList.add("hidden");
        return;
      }

      temporizador = setTimeout(async () => {
        // Cancela o pedido anterior: sem isto, uma resposta lenta pode chegar
        // depois de uma mais recente e sobrepor-lhe resultados antigos.
        if (pedidoActual) pedidoActual.abort();
        pedidoActual = new AbortController();

        try {
          const r = await fetch(`/pesquisa/sugestoes/?q=${encodeURIComponent(termo)}`, {
            signal: pedidoActual.signal,
          });
          const dados = await r.json();
          desenharSugestoes(caixa, dados);
        } catch (e) {
          /* pedido cancelado ou rede em baixo */
        }
      }, 220);
    });

    document.addEventListener("click", (ev) => {
      if (!caixa.contains(ev.target) && ev.target !== campo) caixa.classList.add("hidden");
    });
  }

  /**
   * Constrói as sugestões com nós do DOM em vez de innerHTML.
   *
   * Os nomes vêm da nossa base de dados, mas basta um produto chamado
   * `<img onerror=...>` para o innerHTML o executar. `textContent` fecha essa
   * porta sem custo nenhum.
   */
  function desenharSugestoes(caixa, dados) {
    caixa.replaceChildren();

    const criar = (tag, classe, texto) => {
      const el = document.createElement(tag);
      if (classe) el.className = classe;
      if (texto != null) el.textContent = texto;
      return el;
    };

    if (dados.marcas?.length) {
      caixa.appendChild(criar("p", "eyebrow mb-3", "Marcas"));
      const grelha = criar("div", "mb-6 flex flex-wrap gap-2");
      dados.marcas.forEach((m) => {
        const a = criar(
          "a",
          "border border-border px-3 py-2 text-[11px] uppercase tracking-[0.16em] hover:border-foreground",
          m.nome
        );
        a.href = m.url;
        grelha.appendChild(a);
      });
      caixa.appendChild(grelha);
    }

    if (dados.produtos?.length) {
      caixa.appendChild(criar("p", "eyebrow mb-3", "Peças"));
      const grelha = criar("div", "grid gap-3 sm:grid-cols-2 lg:grid-cols-3");

      dados.produtos.forEach((p) => {
        const a = criar(
          "a",
          "flex items-center gap-3 border border-border p-2 transition-colors hover:border-foreground"
        );
        a.href = p.url;

        if (p.imagem) {
          const img = criar("img", "size-12 shrink-0 bg-surface object-cover");
          img.src = p.imagem;
          img.alt = "";
          img.loading = "lazy";
          a.appendChild(img);
        } else {
          a.appendChild(criar("div", "size-12 shrink-0 bg-surface"));
        }

        const texto = criar("span", "min-w-0");
        texto.appendChild(
          criar("span", "block text-[10px] uppercase tracking-[0.16em] text-muted-foreground", p.marca)
        );
        texto.appendChild(criar("span", "block truncate text-[13px] font-semibold", p.nome));
        a.appendChild(texto);

        grelha.appendChild(a);
      });

      caixa.appendChild(grelha);
    }

    if (!caixa.childElementCount) {
      caixa.appendChild(criar("p", "py-4 text-sm text-muted-foreground", "Nada encontrado."));
    }

    caixa.classList.remove("hidden");
  }

  // ── Animações de entrada ──────────────────────────────────────────────────

  function iniciarRevelacoes() {
    const alvos = $$(".reveal");
    if (!alvos.length) return;

    // Respeita quem pediu menos movimento ao sistema operativo.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      alvos.forEach((el) => el.classList.add("visivel"));
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add("visivel");
          observador.unobserve(entrada.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    alvos.forEach((el) => observador.observe(el));
  }

  // ── Carrinho ──────────────────────────────────────────────────────────────

  function actualizarContador(total) {
    $$("[data-contador-carrinho]").forEach((el) => {
      el.textContent = total;
      el.classList.toggle("hidden", !total);
    });
  }

  function iniciarCarrinho() {
    // Adicionar (página de produto)
    $$("[data-adicionar]").forEach((form) =>
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const botao = form.querySelector('[type="submit"]');
        const original = botao ? botao.textContent : "";
        if (botao) {
          botao.disabled = true;
          botao.textContent = "A adicionar…";
        }
        try {
          const dados = await pedir(form.action, new FormData(form));
          actualizarContador(dados.total_pecas);
          avisar(dados.mensagem || "Adicionado ao carrinho");
        } catch (erro) {
          avisar(erro.message, "erro");
        } finally {
          if (botao) {
            botao.disabled = false;
            botao.textContent = original;
          }
        }
      })
    );

    // Alterar quantidade e remover (página do carrinho) — recarrega para os
    // totais virem sempre do servidor, que é quem sabe as regras de envio.
    $$("[data-linha-carrinho] form").forEach((form) =>
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        try {
          await pedir(form.action, new FormData(form));
          window.location.reload();
        } catch (erro) {
          avisar(erro.message, "erro");
        }
      })
    );
  }

  // ── Favoritos ─────────────────────────────────────────────────────────────

  function iniciarFavoritos() {
    $$("[data-favorito]").forEach((botao) =>
      botao.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const id = botao.dataset.favorito;

        const dados = new FormData();
        dados.append("produto", id);

        try {
          const r = await pedir("/conta/favoritos/alternar/", dados);
          if (r.autenticacao_necessaria) {
            avisar("Inicia sessão para guardar favoritos.");
            return;
          }
          marcarFavorito(botao, r.adicionado);
          avisar(r.adicionado ? "Guardado nos favoritos" : "Removido dos favoritos");
        } catch (erro) {
          avisar(erro.message, "erro");
        }
      })
    );
  }

  function marcarFavorito(botao, activo) {
    botao.setAttribute("aria-pressed", activo ? "true" : "false");
    // Um favorito activo fica sempre visível: escondê-lo no hover faria o
    // cliente perder a noção do que já guardou.
    botao.classList.toggle("opacity-100", activo);
    botao.classList.toggle("opacity-0", !activo);
    const icone = botao.querySelector("svg");
    if (icone) {
      icone.classList.toggle("fill-brand", activo);
      icone.classList.toggle("text-brand", activo);
    }
  }

  // ── Newsletter ────────────────────────────────────────────────────────────

  function iniciarNewsletter() {
    $$("[data-newsletter]").forEach((form) =>
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const resposta = form.querySelector("[data-newsletter-resposta]");

        const dados = new FormData(form);
        dados.append("origem", form.dataset.origem || "footer");

        try {
          const r = await pedir("/newsletter/subscrever/", dados);
          if (resposta) {
            resposta.textContent = r.mensagem;
            resposta.className = "mt-3 text-[11px] uppercase tracking-[0.14em] text-brand";
          }
          form.reset();
        } catch (erro) {
          if (resposta) {
            resposta.textContent = erro.message;
            resposta.className = "mt-3 text-[11px] uppercase tracking-[0.14em] text-destructive";
          }
        }
      })
    );
  }

  // ── Selecção de variante (página de produto) ──────────────────────────────

  function iniciarVariantes() {
    const raiz = $("[data-variantes]");
    if (!raiz) return;

    const mapa = JSON.parse(raiz.dataset.variantes || "{}");
    const campoVariante = $("[data-campo-variante]");
    const infoStock = $("[data-info-stock]");
    const botaoAdicionar = $("[data-botao-adicionar]");
    const campoQtd = $("[data-quantidade]");

    let cor = raiz.dataset.corInicial || Object.keys(mapa)[0] || "";
    let tamanho = null;

    function actualizar() {
      const porTamanho = mapa[cor] || {};

      // Um tamanho sem stock na cor escolhida fica riscado e inactivo: escolher
      // uma combinação inexistente só se descobriria ao carregar em adicionar.
      $$("[data-tamanho]").forEach((botao) => {
        const t = botao.dataset.tamanho;
        const info = porTamanho[t];
        const indisponivel = !info || info.stock === 0;

        botao.disabled = indisponivel;
        botao.classList.toggle("line-through", indisponivel);
        botao.classList.toggle("opacity-40", indisponivel);
        botao.classList.toggle("cursor-not-allowed", indisponivel);
        botao.title = indisponivel ? `Esgotado em ${cor}` : "";

        const escolhido = t === tamanho;
        botao.classList.toggle("border-foreground", escolhido);
        botao.classList.toggle("bg-foreground", escolhido);
        botao.classList.toggle("text-background", escolhido);
      });

      $$("[data-cor]").forEach((botao) => {
        const activo = botao.dataset.cor === cor;
        botao.classList.toggle("border-foreground", activo);
        botao.classList.toggle("ring-1", activo);
        botao.classList.toggle("ring-foreground", activo);
        botao.classList.toggle("ring-offset-2", activo);
      });

      const nomeCor = $("[data-nome-cor]");
      if (nomeCor) nomeCor.textContent = cor;

      const seleccionada = tamanho ? porTamanho[tamanho] : null;
      if (campoVariante) campoVariante.value = seleccionada ? seleccionada.id : "";
      if (botaoAdicionar) botaoAdicionar.disabled = !seleccionada;
      if (campoQtd && seleccionada) campoQtd.max = seleccionada.stock;

      if (infoStock) {
        infoStock.textContent = seleccionada
          ? `${seleccionada.stock} em stock · ${tamanho} / ${cor}`
          : raiz.dataset.stockTotal + " em stock";
      }
    }

    $$("[data-cor]").forEach((botao) =>
      botao.addEventListener("click", () => {
        cor = botao.dataset.cor;
        // Trocar de cor pode invalidar o tamanho escolhido.
        const porTamanho = mapa[cor] || {};
        if (tamanho && (!porTamanho[tamanho] || porTamanho[tamanho].stock === 0)) tamanho = null;
        actualizar();
      })
    );

    $$("[data-tamanho]").forEach((botao) =>
      botao.addEventListener("click", () => {
        if (botao.disabled) return;
        tamanho = botao.dataset.tamanho;
        actualizar();
      })
    );

    $$("[data-qtd]").forEach((botao) =>
      botao.addEventListener("click", () => {
        if (!campoQtd) return;
        const passo = Number(botao.dataset.qtd);
        const maximo = Number(campoQtd.max) || 20;
        campoQtd.value = Math.min(maximo, Math.max(1, Number(campoQtd.value) + passo));
      })
    );

    actualizar();
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    iniciarTema();
    iniciarNavegacao();
    iniciarRevelacoes();
    iniciarCarrinho();
    iniciarFavoritos();
    iniciarNewsletter();
    iniciarVariantes();
  });
})();
