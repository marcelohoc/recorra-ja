// Configuração do site. Tudo o que muda sem mexer no código fica aqui.
window.RECORRA_CONFIG = {
  marca: "Recorra Já",

  // URL do webhook de produção do n8n (workflow "Recorra Já — Diagnóstico de multa com IA").
  // Vazio = o formulário manda o pedido direto para o WhatsApp (modo sem IA).
  webhookUrl: "https://n8n.olimpoit.com.br/webhook/recorra-ja/diagnostico",

  // WhatsApp de atendimento, só números com DDI e DDD (ex.: 5511999998888).
  whatsapp: "",

  // Links de pagamento por plano (Mercado Pago, Kiwify, Asaas, Stripe...).
  // O site acrescenta ?ref=CODIGO_DO_PEDIDO ao link. Vazio = fechamento pelo WhatsApp com Pix.
  pagamento: {
    simples: "",
    gravissima: "",
    suspensao: ""
  },

  // Preços exibidos na página (os preços cobrados vêm do backend em planos.json — mantenha iguais).
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
