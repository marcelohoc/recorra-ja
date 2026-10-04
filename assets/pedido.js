// Páginas pós-pagamento: dados.html (formulário) e defesa.html (entrega).
(function () {
  "use strict";
  var C = window.RECORRA_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var P = q.get("p"), T = q.get("t");
  var pagina = document.body.getAttribute("data-pagina");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dataBR(iso) { if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || ""; var p = iso.slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function digitos(s) { return String(s || "").replace(/\D/g, ""); }
  function mostrar(id) {
    ["estado-carregando", "estado-erro", "estado-revisao", "form-dados", "estado-pronta"].forEach(function (x) { if ($(x)) $(x).hidden = x !== id; });
  }
  function carregando(titulo, texto) { $("carregando-titulo").textContent = titulo; $("carregando-texto").textContent = texto || ""; mostrar("estado-carregando"); }
  function erro(texto) { if (texto) $("erro-texto").textContent = texto; mostrar("estado-erro"); }
  document.querySelectorAll(".num-pedido").forEach(function (el) { el.textContent = P || ""; });

  function consultar() {
    return fetch(C.n8nBase + "/recorra-ja/pedido?p=" + encodeURIComponent(P) + "&t=" + encodeURIComponent(T)).then(function (r) { return r.json(); });
  }
  // Repete a consulta até o status sair da lista de espera
  function esperar(statusEspera, aCada, max, cb) {
    var n = 0;
    (function vai() {
      n++;
      consultar().then(function (v) {
        if (v && v.ok && statusEspera.indexOf(v.status) >= 0 && n < max) return setTimeout(vai, aCada);
        cb(v);
      }).catch(function () { if (n < max) setTimeout(vai, aCada * 2); else cb(null); });
    })();
  }

  if (!P || !T || !C.n8nBase) return erro();

  // ---------------- dados.html ----------------
  function rotear(v) {
    if (!v || !v.ok) return erro(v && v.erro);
    if (v.status === "diagnosticado" || v.status === "falha_ia") {
      carregando("Confirmando seu pagamento…", "Pix costuma confirmar em segundos. Não feche esta página.");
      return esperar(["diagnosticado", "falha_ia"], 4000, 75, function (v2) {
        if (v2 && v2.ok && v2.status !== "diagnosticado" && v2.status !== "falha_ia") return rotear(v2);
        erro("Ainda não recebemos a confirmação do pagamento. Assim que ele for aprovado, você recebe por e-mail o link para continuar.");
      });
    }
    if (v.status === "pago") return mostrarForm(v);
    if (v.status === "processando") {
      carregando("Montando sua defesa…", "Estamos preenchendo a peça com seus dados e preparando o passo a passo. Leva cerca de 1 a 2 minutos.");
      return esperar(["processando"], 4000, 90, function (v2) {
        if (v2 && v2.ok && v2.status !== "processando") return rotear(v2);
        mostrar("estado-revisao");
      });
    }
    if (v.status === "em_revisao") return mostrar("estado-revisao");
    if (v.status === "entregue") { location.href = "defesa.html?p=" + encodeURIComponent(P) + "&t=" + encodeURIComponent(T); return; }
    erro("Status do pedido: " + v.status + ". Fale com a gente pelo e-mail " + ((C.empresa || {}).email || "") + ".");
  }

  function mostrarForm(v) {
    var d = v.diagnostico || {}, dm = d.dados || {};
    $("resumo-multa").innerHTML = [["Infração", dm.descricao_infracao], ["Órgão", dm.orgao_autuador], ["Placa", dm.placa], ["Prazo final", dataBR(v.prazo && v.prazo.data)]]
      .filter(function (c) { return c[1]; }).map(function (c) { return "<div><span>" + esc(c[0]) + "</span><b>" + esc(c[1]) + "</b></div>"; }).join("");
    var pre = v.prefill || {};
    $("nome_completo").value = pre.nome || "";
    $("uf").value = pre.uf || "";
    if (pre.outra_infracao_12m) { var r = document.querySelector('input[name=outra][value="' + pre.outra_infracao_12m + '"]'); if (r) r.checked = true; }
    var pend = (d.pendencias || []).filter(function (p) { return !/12 meses/i.test(p); });
    $("perguntas").innerHTML = pend.length ? "<p><b>Para fortalecer sua defesa, responda se souber:</b></p>" + pend.map(function (p, i) {
      return '<label>' + esc(p) + '<textarea rows="2" data-pergunta="' + esc(p) + '" id="perg-' + i + '" placeholder="Se não souber, deixe em branco"></textarea></label>';
    }).join("") : "";
    mostrar("form-dados");
  }

  if (pagina === "dados") {
    var cpf = $("cpf"), cep = $("cep");
    cpf.addEventListener("input", function () {
      var d = digitos(cpf.value).slice(0, 11);
      cpf.value = d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    });
    cep.addEventListener("input", function () { var d = digitos(cep.value).slice(0, 8); cep.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; });

    $("form-dados").addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = [];
      if ($("nome_completo").value.trim().split(/\s+/).length < 2) msg.push("Informe seu nome completo.");
      if (digitos(cpf.value).length !== 11) msg.push("CPF incompleto.");
      var cnh = digitos($("cnh").value);
      if (cnh.length < 9 || cnh.length > 11 || /^(\d)\1+$/.test(cnh)) msg.push("Confira o número de registro da CNH (9 a 11 dígitos, campo Nº REGISTRO).");
      if (digitos(cep.value).length !== 8) msg.push("CEP incompleto.");
      if ($("endereco").value.trim().length < 8) msg.push("Informe o endereço completo.");
      if (!$("cidade").value.trim() || $("uf").value.trim().length !== 2) msg.push("Informe cidade e UF.");
      if (!$("declaracao").checked) msg.push("Confirme que as informações são verdadeiras.");
      if (msg.length) { $("erro").textContent = msg.join(" "); $("erro").hidden = false; return; }
      $("erro").hidden = true;

      var respostas = [];
      document.querySelectorAll("#perguntas textarea").forEach(function (t) { if (t.value.trim()) respostas.push({ pergunta: t.getAttribute("data-pergunta"), resposta: t.value.trim() }); });
      var corpo = {
        p: P, t: T,
        nome_completo: $("nome_completo").value.trim(), cpf: cpf.value, cnh: $("cnh").value.trim(),
        endereco: $("endereco").value.trim(), cep: cep.value, cidade: $("cidade").value.trim(), uf: $("uf").value.trim(),
        condutor: document.querySelector("input[name=condutor]:checked").value,
        outra_infracao_12m: document.querySelector("input[name=outra]:checked").value,
        respostas: respostas, declaracao: true
      };
      $("enviar").disabled = true;
      fetch(C.n8nBase + "/recorra-ja/dados", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(corpo) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) return rotear({ ok: true, status: res.status || "processando" });
          $("erro").textContent = (res && res.erro) || "Não foi possível enviar. Tente de novo."; $("erro").hidden = false;
        })
        .catch(function () { $("erro").textContent = "Falha de conexão. Tente de novo."; $("erro").hidden = false; })
        .finally(function () { $("enviar").disabled = false; });
    });

    carregando("Carregando seu pedido…");
    consultar().then(rotear).catch(function () { erro("Falha de conexão. Recarregue a página."); });
  }

  // ---------------- defesa.html ----------------
  if (pagina === "defesa") {
    carregando("Carregando sua defesa…");
    consultar().then(function (v) {
      if (!v || !v.ok) return erro(v && v.erro);
      if (v.status !== "entregue") {
        if (v.status === "pago" || v.status === "processando") { location.href = "dados.html?p=" + encodeURIComponent(P) + "&t=" + encodeURIComponent(T); return; }
        return erro(v.status === "em_revisao" ? "Sua defesa está em conferência pela nossa equipe. Você recebe por e-mail em até 24 horas úteis." : "Esta defesa ainda não está disponível.");
      }
      $("folha").textContent = v.defesa_final || "";
      var g = v.guia || {};
      if (g.prazo_final) {
        $("prazo-box").hidden = false; $("prazo-data").textContent = dataBR(g.prazo_final);
        if (v.prazo && v.prazo.dias_restantes !== null && v.prazo.dias_restantes !== undefined) $("prazo-dias").textContent = v.prazo.dias_restantes >= 0 ? "Faltam " + v.prazo.dias_restantes + " dia(s)" : "O prazo indicado já passou";
      }
      var lista = function (a) { return (a || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); };
      $("guia").innerHTML = "<h2>" + esc(g.titulo || "Como protocolar") + "</h2>" + (g.resumo ? "<p>" + esc(g.resumo) + "</p>" : "") +
        '<ol class="passos-guia">' + (g.passos || []).map(function (p) { return "<li><b>" + esc(p.titulo) + "</b><br>" + esc(p.descricao) + "</li>"; }).join("") + "</ol>" +
        ((g.documentos || []).length ? "<h3>Documentos para anexar</h3><ul>" + lista(g.documentos) + "</ul>" : "") +
        ((g.depois_de_protocolar || []).length ? "<h3>Depois de protocolar</h3><ul>" + lista(g.depois_de_protocolar) + "</ul>" : "") +
        (g.se_for_negado ? "<p><b>Se for negado:</b> " + esc(g.se_for_negado) + "</p>" : "") +
        '<p class="nota">Resultado não garantido: a decisão é do órgão de trânsito. Guarde o comprovante de protocolo.</p>';
      mostrar("estado-pronta");
      $("imprimir").addEventListener("click", function () { window.print(); });
      $("copiar").addEventListener("click", function () {
        var b = $("copiar");
        (navigator.clipboard ? navigator.clipboard.writeText(v.defesa_final) : Promise.reject()).then(function () { b.textContent = "Texto copiado ✔"; })
          .catch(function () { b.textContent = "Selecione o texto da defesa e copie"; });
      });
    }).catch(function () { erro("Falha de conexão. Recarregue a página."); });
  }
})();
