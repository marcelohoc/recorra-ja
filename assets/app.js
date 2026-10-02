(function () {
  "use strict";

  var C = window.RECORRA_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  var MAX_PDF = 10 * 1024 * 1024;
  var TIMEOUT_MS = 240000;

  // ---------- utilidades ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function reais(v) { return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }
  function soDigitos(s) { return String(s || "").replace(/\D/g, ""); }
  // Sem WhatsApp configurado, o contato cai no e-mail para nenhum lead se perder.
  var CANAL = C.whatsapp ? "WhatsApp" : "e-mail";
  function linkWhats(msg) {
    if (C.whatsapp) return "https://wa.me/" + soDigitos(C.whatsapp) + "?text=" + encodeURIComponent(msg);
    var email = (C.empresa || {}).email;
    if (!email) return null;
    return "mailto:" + email + "?subject=" + encodeURIComponent("Recorra Já — análise de multa") + "&body=" + encodeURIComponent(msg);
  }
  function guardar(chave, valor) { try { sessionStorage.setItem(chave, JSON.stringify(valor)); } catch (e) {} }
  function ler(chave) { try { return JSON.parse(sessionStorage.getItem(chave)); } catch (e) { return null; } }
  function pixel(evento, dados) { try { if (window.fbq) window.fbq("track", evento, dados || {}); } catch (e) {} }
  function dataBR(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
    var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0];
  }

  // ---------- UTM ----------
  (function () {
    var q = new URLSearchParams(location.search), utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(function (k) {
      if (q.get(k)) utm[k] = q.get(k);
    });
    if (Object.keys(utm).length) guardar("rj_utm", utm);
  })();

  // ---------- Meta Pixel (opcional) ----------
  if (C.metaPixelId) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", C.metaPixelId);
    window.fbq("track", "PageView");
  }

  // ---------- Planos ----------
  var lista = $("lista-planos");
  if (lista && C.planos) {
    var extras = {
      simples: ["Defesa prévia ou recurso à JARI", "Pedido de advertência quando cabível", "Passo a passo para protocolar"],
      gravissima: ["Tudo do plano Simples", "Estratégia para proteger a CNH provisória", "Acompanhamento até a 2ª instância"],
      suspensao: ["Defesa no processo de suspensão", "Uso do efeito suspensivo (art. 285)", "Recursos à JARI e ao CETRAN"]
    };
    lista.innerHTML = ["simples", "gravissima", "suspensao"].map(function (id) {
      var p = C.planos[id]; if (!p) return "";
      return '<article class="plano' + (id === "gravissima" ? " popular" : "") + '">' +
        (id === "gravissima" ? '<span class="tag">Mais pedido</span>' : "") +
        "<h3>" + esc(p.nome) + "</h3>" +
        '<div class="preco">' + esc(reais(p.preco)) + " <small>à vista</small></div>" +
        "<p>" + esc(p.descricao) + "</p>" +
        "<ul>" + extras[id].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        '<a class="btn btn-sec btn-bloco" href="#analisar">Começar pela análise grátis</a>' +
        "</article>";
    }).join("");
  }

  // ---------- Rodapé e WhatsApp ----------
  var emp = C.empresa || {};
  if ($("dados-empresa")) {
    var partes = [];
    if (emp.razaoSocial) partes.push(esc(emp.razaoSocial));
    if (emp.cnpj) partes.push("CNPJ " + esc(emp.cnpj));
    if (emp.email) partes.push('<a href="mailto:' + esc(emp.email) + '">' + esc(emp.email) + "</a>");
    $("dados-empresa").innerHTML = partes.join(" · ");
  }
  var wf = $("whats-flutuante");
  if (wf && C.whatsapp) {
    wf.href = linkWhats("Olá! Recebi uma multa e quero saber se dá para recorrer.");
    wf.target = "_blank"; wf.rel = "noopener"; wf.hidden = false;
  }

  // ---------- Formulário ----------
  var form = $("form");
  if (!form) return;

  var arquivoProcessado = null; // { media_type, data(base64), nome }

  $("whatsapp").addEventListener("input", function (e) {
    var d = soDigitos(e.target.value).slice(0, 11), out = d;
    if (d.length > 2) out = "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length > 7) out = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
    e.target.value = out;
  });

  function lerComoBase64(blob) {
    return new Promise(function (ok, falha) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(",")[1]); };
      r.onerror = falha;
      r.readAsDataURL(blob);
    });
  }

  // Reduz fotos grandes para no máximo 2000px (mantém legível e deixa o envio rápido no 4G)
  function comprimirImagem(arquivo) {
    return new Promise(function (ok) {
      var url = URL.createObjectURL(arquivo), img = new Image();
      img.onload = function () {
        var max = 2000, w = img.naturalWidth, h = img.naturalHeight, f = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * f); cv.height = Math.round(h * f);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { ok(b ? { blob: b, tipo: "image/jpeg" } : null); }, "image/jpeg", 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    });
  }

  $("arquivo").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    arquivoProcessado = null;
    $("upload").classList.remove("ok");
    $("arquivo-nome").hidden = true;
    if (!f) return;
    mostrarErro("");
    var etiqueta = $("arquivo-nome");
    etiqueta.textContent = "Preparando " + f.name + "…"; etiqueta.hidden = false;

    var pronto;
    if (f.type === "application/pdf") {
      if (f.size > MAX_PDF) { mostrarErro("O PDF passa de 10 MB. Tire uma foto da notificação ou envie um PDF menor."); etiqueta.hidden = true; return; }
      pronto = lerComoBase64(f).then(function (b64) { return { media_type: "application/pdf", data: b64 }; });
    } else {
      pronto = comprimirImagem(f).then(function (r) {
        if (r) return lerComoBase64(r.blob).then(function (b64) { return { media_type: r.tipo, data: b64 }; });
        if (TIPOS_IMAGEM.indexOf(f.type) >= 0) return lerComoBase64(f).then(function (b64) { return { media_type: f.type, data: b64 }; });
        throw new Error("formato");
      });
    }
    pronto.then(function (a) {
      a.nome = f.name; arquivoProcessado = a;
      etiqueta.textContent = "✓ " + f.name + " pronto para análise";
      $("upload").classList.add("ok");
    }).catch(function () {
      etiqueta.hidden = true;
      mostrarErro("Não conseguimos abrir esse arquivo. Envie uma foto (JPG ou PNG) ou um PDF da notificação.");
    });
  });

  function mostrarErro(msg) {
    var el = $("erro"); el.textContent = msg; el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function painel(qual) {
    ["painel-form", "painel-carregando", "painel-resultado"].forEach(function (id) { $(id).hidden = id !== qual; });
    $("analisar").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  var timerEtapas = null;
  function animarEtapas() {
    var itens = $("etapas").querySelectorAll("li"), i = 0;
    itens.forEach(function (li) { li.className = ""; });
    itens[0].className = "ativa";
    timerEtapas = setInterval(function () {
      if (i < itens.length - 1) { itens[i].className = "feita"; i++; itens[i].className = "ativa"; }
    }, 9000);
  }

  function coletar() {
    var outra = form.querySelector("input[name=outra]:checked");
    return {
      nome: $("nome").value.trim(),
      email: $("email").value.trim(),
      whatsapp: $("whatsapp").value.trim(),
      uf: $("uf").value,
      cnh_provisoria: $("cnh_provisoria").checked,
      profissional: $("profissional").checked,
      outra_infracao_12m: outra ? outra.value : "não sei",
      relato: $("relato").value.trim(),
      consentimento: $("consentimento").checked,
      utm: ler("rj_utm") || {}
    };
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var dados = coletar();
    if (!arquivoProcessado) return mostrarErro("Envie a foto ou o PDF da notificação.");
    if (soDigitos(dados.whatsapp).length < 10) return mostrarErro("Informe seu WhatsApp com DDD.");
    if (!dados.consentimento) return mostrarErro("Para continuar, aceite os termos e a política de privacidade.");
    mostrarErro("");
    pixel("Lead");

    if (!C.webhookUrl) return semIA(dados, null);

    dados.arquivo = { media_type: arquivoProcessado.media_type, data: arquivoProcessado.data };
    $("enviar").disabled = true;
    painel("painel-carregando");
    animarEtapas();

    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    fetch(C.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
      signal: ctrl.signal
    })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (res) {
        if (res && res.ok && res.diagnostico) { guardar("rj_ultimo", res); mostrarResultado(res, dados); }
        else semIA(dados, res && res.erro, res && res.pedido);
      })
      .catch(function () { semIA(dados, null); })
      .finally(function () { clearTimeout(t); clearInterval(timerEtapas); $("enviar").disabled = false; });
  });

  // Quando a análise automática não está disponível, o pedido segue pelo WhatsApp.
  function semIA(dados, erro, pedido) {
    var msg = "Olá! Quero uma análise da minha multa." + (pedido ? " Pedido " + pedido + "." : "") +
      "\nNome: " + (dados.nome || "-") + "\nEstado: " + (dados.uf || "-") +
      (dados.cnh_provisoria ? "\nCNH provisória: sim" : "") + (dados.relato ? "\nO que aconteceu: " + dados.relato : "") +
      "\nVou enviar a foto da notificação aqui.";
    var w = linkWhats(msg);
    $("painel-resultado").innerHTML = '<div class="resultado">' +
      "<h2>Recebemos seu pedido</h2>" +
      "<p>" + esc(erro || "Nossa análise automática está com muita demanda agora.") + "</p>" +
      (w ? "<p>Para não perder seu prazo, envie a foto da notificação por " + CANAL + " e um especialista faz sua análise grátis.</p>" +
        '<a class="btn btn-whats btn-lg btn-bloco" target="_blank" rel="noopener" href="' + esc(w) + '">Enviar por ' + CANAL + '</a>'
        : '<p>Um especialista vai te chamar no WhatsApp informado.</p>') +
      '<p class="nota"><a href="#" id="tentar-de-novo">Tentar a análise automática de novo</a></p></div>';
    painel("painel-resultado");
    var again = $("tentar-de-novo");
    if (again) again.addEventListener("click", function (ev) { ev.preventDefault(); painel("painel-form"); });
  }

  function mostrarResultado(res, dados) {
    var d = res.diagnostico, dm = d.dados || {}, pz = res.prazo || {}, pl = res.plano || {};
    var html = '<div class="resultado">';

    html += '<div class="res-topo"><h2>Seu diagnóstico</h2><span class="res-pedido">Pedido ' + esc(res.pedido) + "</span></div>";

    if (!d.documento_valido) {
      html += '<div class="alerta">' + esc(d.resumo_para_cliente) + "</div>" +
        '<button class="btn btn-sec btn-bloco" id="voltar">Enviar outra foto</button></div>';
      $("painel-resultado").innerHTML = html; painel("painel-resultado");
      $("voltar").addEventListener("click", function () { painel("painel-form"); });
      return;
    }

    // Prazo
    if (pz.dias_restantes !== null && pz.dias_restantes !== undefined) {
      var dias = pz.dias_restantes, cls = dias <= 7 ? "urgente" : dias > 15 ? "ok" : "";
      var txt = dias < 0 ? "O prazo indicado já passou" : dias === 0 ? "O prazo termina hoje" : "dias para " + esc(d.recurso_cabivel || "recorrer").toLowerCase();
      html += '<div class="prazo-box ' + (dias < 0 ? "urgente" : cls) + '">' +
        (dias >= 0 ? '<span class="dias">' + esc(dias) + "</span>" : "") +
        "<div><b>" + txt + "</b><br><small>Prazo final: " + esc(dataBR(pz.data)) + (pz.estimado ? " (estimado)" : "") + "</small></div></div>";
    }

    html += "<p>" + esc(d.resumo_para_cliente) + "</p>";

    if (d.risco_suspensao) html += '<div class="alerta">Atenção: esta multa coloca sua CNH em risco (suspensão ou perda da CNH definitiva). Recorra dentro do prazo — o recurso tem efeito suspensivo.</div>';

    // Dados lidos
    var GRAV = { leve: "Leve", media: "Média", grave: "Grave", gravissima: "Gravíssima" };
    var campos = [["Infração", dm.descricao_infracao], ["Órgão", dm.orgao_autuador], ["Placa", dm.placa], ["Data", dataBR(dm.data_infracao)], ["Gravidade", GRAV[dm.gravidade] || ""], ["Valor", dm.valor_multa], ["Pontos", dm.pontos]];
    html += '<div class="dados-multa">' + campos.filter(function (c) { return c[1] !== null && c[1] !== undefined && c[1] !== "" && c[1] !== "desconhecida"; })
      .map(function (c) { return "<div><span>" + esc(c[0]) + "</span><b>" + esc(c[1]) + "</b></div>"; }).join("") + "</div>";

    // Pontos de defesa
    var pts = d.pontos_de_defesa || [];
    var fortes = pts.filter(function (p) { return p.forca === "forte"; }).length;
    html += "<h3>" + (pts.length ? pts.length + (pts.length > 1 ? " pontos de defesa encontrados" : " ponto de defesa encontrado") + (fortes ? " (" + fortes + " forte" + (fortes > 1 ? "s" : "") + ")" : "") : "Nenhum vício formal encontrado") + "</h3>";
    html += '<ul class="pontos">' + pts.map(function (p) {
      var rot = { forte: "Ponto forte", media: "Ponto médio", fraca: "Ponto fraco" }[p.forca] || p.forca;
      return '<li class="ponto ' + esc(p.forca) + '"><span class="forca">' + esc(rot) + "</span><h4>" + esc(p.titulo) + "</h4><p>" + esc(p.explicacao) + "</p><small>" + esc(p.fundamento) + "</small></li>";
    }).join("") + "</ul>";

    if (d.nao_cabe_recurso_motivo) html += '<div class="alerta">' + esc(d.nao_cabe_recurso_motivo) + "</div>";

    if ((d.pendencias || []).length) {
      html += '<div class="pendencias"><b>Para fortalecer sua defesa, vamos precisar de:</b><ul>' +
        d.pendencias.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul></div>";
    }

    // Prévia bloqueada
    html += '<div class="bloqueado"><div class="borrado">ILMO(A). SR(A). PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRAÇÕES – JARI. Requerente, já qualificado, vem respeitosamente apresentar DEFESA em face do auto de infração, pelas razões de fato e de direito a seguir expostas. DOS FATOS. DO DIREITO. Do vício formal do auto de infração…</div>' +
      '<div class="cadeado">🔒 Sua defesa completa já está sendo preparada</div></div>';

    // Oferta
    var semPontos = !pts.length;
    var pagar = (C.pagamento || {})[pl.id];
    var refLink = pagar ? pagar + (pagar.indexOf("?") >= 0 ? "&" : "?") + "ref=" + encodeURIComponent(res.pedido) : null;
    var msgW = "Olá! Quero contratar a " + pl.nome + " (" + reais(pl.preco) + "). Meu pedido é " + res.pedido + ".";
    var w = linkWhats(msgW);
    html += '<div class="oferta"><div><b>' + esc(pl.nome) + '</b></div><div class="preco">' + esc(reais(pl.preco)) + "</div>" +
      "<p class=\"muted\">Defesa completa revisada por especialista, pronta para assinar, com o passo a passo para protocolar. Entrega em até 24h úteis." +
      (semPontos ? " <b>Como não encontramos vício formal, a defesa será de mérito; fale com a gente antes de contratar.</b>" : "") + "</p>" +
      '<div class="acoes">' +
      (refLink && !semPontos ? '<a class="btn btn-lg btn-bloco" id="btn-pagar" href="' + esc(refLink) + '" target="_blank" rel="noopener">Quero minha defesa</a>' : "") +
      (w ? '<a class="btn ' + (refLink && !semPontos ? "btn-sec" : "btn-whats btn-lg") + ' btn-bloco" id="btn-whats" href="' + esc(w) + '" target="_blank" rel="noopener">' + (refLink && !semPontos ? "Tirar dúvidas por " + CANAL : "Contratar por " + CANAL) + "</a>" : "") +
      (!refLink && !w ? '<p>Um especialista vai te chamar no WhatsApp ' + esc(dados.whatsapp) + " para finalizar.</p>" : "") +
      "</div></div>";

    html += '<p class="nota">Diagnóstico gerado por inteligência artificial com base no Código de Trânsito Brasileiro e revisado por especialista antes da entrega da defesa. Não é garantia de resultado.</p></div>';

    $("painel-resultado").innerHTML = html;
    painel("painel-resultado");
    var bp = $("btn-pagar"); if (bp) bp.addEventListener("click", function () { pixel("InitiateCheckout", { value: pl.preco, currency: "BRL" }); });
    var bw = $("btn-whats"); if (bw) bw.addEventListener("click", function () { pixel("Contact"); });
  }
})();
