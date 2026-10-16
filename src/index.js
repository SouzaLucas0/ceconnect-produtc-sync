const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const { runSync, statePathFor } = require('./sync');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const cfg = loadConfig();
  const log = createLogger(cfg.baseDir);
  const statePath = statePathFor(cfg.baseDir);

  log.info(
    `Serviço iniciado. Cliente: "${cfg.cliente}", empresa ${cfg.sync.empresas.join(", ")}, ` +
      `setores ${cfg.sync.setores.join(',')}, a cada ${cfg.sync.intervaloMinutos} min`,
  );

  // Laço sequencial: uma execução nunca se sobrepõe à próxima
  while (true) {
    try {
      await runSync(cfg, log, statePath);
    } catch (err) {
      log.error(`Sincronização falhou: ${err.message}`);
    }
    await sleep(cfg.sync.intervaloMinutos * 60 * 1000);
  }
}

process.on('unhandledRejection', (err) => {
  console.error('Erro não tratado:', err);
});

main().catch((err) => {
  console.error(`Falha ao iniciar: ${err.message}`);
  process.exit(1);
});
