const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${body}`);
    this.status = status;
  }
}

// Envia um lote para POST /products/add. Repete em erros de rede ou 5xx.
// Erros 4xx não são repetidos, porque a mesma requisição falharia de novo.
async function sendBatch(api, items, { tentativas = 3 } = {}) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const res = await fetch(`${api.url}/products/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-password': api.password,
        },
        body: JSON.stringify(items),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        throw new HttpError(res.status, await res.text());
      }
      return;
    } catch (err) {
      const erroDoCliente = err.status && err.status >= 400 && err.status < 500;
      if (erroDoCliente || tentativa >= tentativas) throw err;
      await sleep(tentativa * 5000);
    }
  }
}

module.exports = { sendBatch };
