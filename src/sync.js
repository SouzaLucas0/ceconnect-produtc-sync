const path = require('path');
const { fetchProdutos } = require('./firebird');
const { sendBatch } = require('./api');
const { loadState, saveState, prune } = require('./state');

// Limites do DTO da API
const LIMITES = { codigo: 50, descricao: 255, marca: 100, referencia: 100 };

const texto = (valor, limite) => {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  if (!s) return null;
  return s.length > limite ? s.slice(0, limite) : s;
};

const arredondar = (valor, casas) => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  const fator = 10 ** casas;
  return Math.round(n * fator) / fator;
};

// Converte uma linha do Firebird no formato da API.
// A ordem das chaves é fixa, para a comparação com o estado ser confiável.
function toPayload(row, cliente) {
  return {
    cliente,
    codigo: texto(row.CODIGOPRODUTO, LIMITES.codigo),
    descricao: texto(row.DESCRICAOPRODUTO, LIMITES.descricao),
    valor: Math.max(0, arredondar(row.PRECOVENDA, 2)),
    marca: texto(row.DESCRICAOMARCA, LIMITES.marca),
    referencia: texto(row.REFERENCIA, LIMITES.referencia),
    estoque: Math.max(0, arredondar(row.ESTOQUEATUAL, 3)),
    ativo: String(row.ATIVO ?? '').trim().toUpperCase() === 'S',
  };
}

async function runSync(cfg, log, statePath) {
  const inicio = Date.now();

  const rows = await fetchProdutos(cfg);

  // Proteção: consulta vazia pode ser erro de configuração.
  // Nesse caso não inativamos nada.
  if (rows.length === 0) {
    throw new Error('Consulta não retornou produtos. Verifique [sync] empresa e setores.');
  }

  const estado = loadState(statePath);
  const atuais = new Map();
  let ignorados = 0;

  for (const row of rows) {
    const payload = toPayload(row, cfg.cliente);
    if (!payload.codigo || !payload.descricao) {
      ignorados++;
      log.warn(`Produto ignorado (sem código ou descrição): ${JSON.stringify(row)}`);
      continue;
    }
    atuais.set(payload.codigo, payload);
  }

  // 1. Produtos novos ou alterados
  const envios = [];
  for (const [codigo, payload] of atuais) {
    if (JSON.stringify(estado[codigo]) !== JSON.stringify(payload)) {
      envios.push(payload);
    }
  }

  // 2. Produtos que saíram da consulta (ex.: mudaram de setor): inativar
  for (const [codigo, anterior] of Object.entries(estado)) {
    if (!atuais.has(codigo) && anterior.ativo) {
      envios.push({ ...anterior, ativo: false });
    }
  }

  log.info(
    `Consulta: ${rows.length} linha(s), ${atuais.size} produto(s), ` +
      `${ignorados} ignorado(s), ${envios.length} para enviar`,
  );

  // Envia em lotes. O estado é salvo após cada lote bem-sucedido.
  let enviados = 0;
  let falhas = 0;
  const lote = cfg.sync.lote;

  for (let i = 0; i < envios.length; i += lote) {
    const bloco = envios.slice(i, i + lote);
    try {
      await sendBatch(cfg.api, bloco);
      for (const payload of bloco) {
        estado[payload.codigo] = payload;
      }
      enviados += bloco.length;
    } catch (err) {
      falhas += bloco.length;
      log.error(`Lote ${Math.floor(i / lote) + 1} falhou (${bloco.length} item(ns)): ${err.message}`);
    }
    prune(estado, atuais);
    saveState(statePath, estado);
  }

  prune(estado, atuais);
  saveState(statePath, estado);

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  log.info(`Sincronização concluída em ${segundos}s: ${enviados} enviado(s), ${falhas} com falha`);
}

module.exports = { runSync, statePathFor: (baseDir) => path.join(baseDir, 'estado.json') };
