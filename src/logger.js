const fs = require('fs');
const path = require('path');

const DIAS_DE_LOG = 30;

// Remove logs mais antigos que DIAS_DE_LOG
function limparLogsAntigos(dir) {
  const limite = Date.now() - DIAS_DE_LOG * 24 * 60 * 60 * 1000;
  for (const arquivo of fs.readdirSync(dir)) {
    const caminho = path.join(dir, arquivo);
    if (fs.statSync(caminho).mtimeMs < limite) fs.unlinkSync(caminho);
  }
}

// Um arquivo por dia: logs/sync-AAAA-MM-DD.log
function createLogger(baseDir) {
  const dir = path.join(baseDir, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  limparLogsAntigos(dir);

  const write = (nivel, mensagem) => {
    const agora = new Date();
    const dia = agora.toLocaleDateString('sv-SE'); // AAAA-MM-DD no horário local
    const linha = `${agora.toLocaleString('pt-BR')} [${nivel}] ${mensagem}\n`;
    fs.appendFileSync(path.join(dir, `sync-${dia}.log`), linha);
    process.stdout.write(linha);
  };

  return {
    info: (msg) => write('INFO', msg),
    warn: (msg) => write('WARN', msg),
    error: (msg) => write('ERROR', msg),
  };
}

module.exports = { createLogger };
