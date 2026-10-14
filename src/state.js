const fs = require('fs');

// Estado = último payload enviado com sucesso para cada código de produto.
// Serve para enviar só o que mudou e para inativar o que sumiu da consulta.

function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Arquivo ausente ou corrompido: começa do zero (reenvia tudo, sem perder nada)
    return {};
  }
}

// Grava em arquivo temporário e troca no final, para não corromper o estado
function saveState(file, state) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
}

// Remove inativos que já foram enviados e não estão mais na consulta
function prune(state, atuais) {
  for (const codigo of Object.keys(state)) {
    if (!atuais.has(codigo) && !state[codigo].ativo) {
      delete state[codigo];
    }
  }
}

module.exports = { loadState, saveState, prune };
