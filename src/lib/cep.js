// src/lib/cep.js
// Busca endereço pelo CEP usando ViaCEP (Brasil)

export function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

export function isValidCep(cep) {
  const d = onlyDigits(cep);
  return d.length === 8;
}

export async function fetchAddressFromCep(cep) {
  const d = onlyDigits(cep);
  if (d.length !== 8) return { ok: false, error: "CEP inválido" };

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!resp.ok) return { ok: false, error: "Não foi possível consultar o CEP" };
    const json = await resp.json();
    if (!json || json.erro) return { ok: false, error: "CEP não encontrado" };

    return {
      ok: true,
      data: {
        street: json.logradouro || "",
        neighborhood: json.bairro || "",
        city: json.localidade || "",
        uf: json.uf || "",
      },
    };
  } catch {
    return { ok: false, error: "Erro ao consultar o CEP" };
  }
}
