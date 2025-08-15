const fetch = require("node-fetch");

const TOKEN = "SEU_TOKEN_SANDBOX"; // Cole aqui seu token sandbox

const criarPix = async () => {
  try {
    const resp = await fetch("https://secure.sandbox.api.pagseguro.com/instant-payments/cob", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        calendario: { expiracao: 3600 },
        devedor: { cpf: "12345678909", nome: "Fulano de Tal" },
        valor: { original: "1.00" },
        chave: "SUA_CHAVE_PIX_AQUI",
        solicitacaoPagador: "Pagamento de teste"
      })
    });

    const data = await resp.json();
    console.log(data);
  } catch (err) {
    console.error("Erro na conexão:", err);
  }
};

criarPix();
