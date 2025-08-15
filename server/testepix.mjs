// server/testepix.mjs
const BASE = "http://localhost:5174";

async function criarPix() {
  try {
    const resp = await fetch(`${BASE}/api/pagbank/pix/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1.00 }),
    });

    const data = await resp.json();
    console.log("STATUS:", resp.status);
    console.log(data);

    if (!resp.ok) {
      console.error("Falha ao criar Pix PagBank:", data);
      process.exit(1);
    }
  } catch (err) {
    console.error("Erro ao chamar o servidor local:", err.message);
    process.exit(1);
  }
}

criarPix();
