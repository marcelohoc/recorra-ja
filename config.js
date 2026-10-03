// Configuração do site. Tudo o que muda sem mexer no código fica aqui.
window.RECORRA_CONFIG = {
  marca: "Recorra Já",

  // Base dos webhooks do n8n (workflows "Recorra Já 1 a 5" ativos).
  // Os endpoints usados são: /recorra-ja/diagnostico, /recorra-ja/pedido e /recorra-ja/dados.
  // Vazio = o formulário manda o pedido direto para o contato (modo sem IA).
  n8nBase: "https://n8n.olimpoit.com.br/webhook",

  // WhatsApp de atendimento, só números com DDI e DDD (ex.: 5511999998888). Vazio = contato por e-mail.
  whatsapp: "",

  // Preços exibidos na página (o valor cobrado vem do backend em planos.json — mantenha iguais).
  planos: {
    simples: { nome: "Defesa Simples", preco: 67, descricao: "Infrações leves, médias e graves sem risco à CNH." },
    gravissima: { nome: "Gravíssima / CNH Provisória", preco: 197, descricao: "Gravíssimas ou qualquer multa com CNH provisória." },
    suspensao: { nome: "Contra Suspensão da CNH", preco: 397, descricao: "Lei Seca, recusa ao bafômetro, velocidade +50%, pontos." }
  },

  // Meta Pixel (opcional). Vazio = desativado.
  metaPixelId: "",

  // Dados do responsável, exibidos no rodapé e nos termos.
  empresa: {
    razaoSocial: "",
    cnpj: "",
    email: "marcelohoc@gmail.com"
  }
};
