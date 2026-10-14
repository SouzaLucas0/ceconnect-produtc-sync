const fs = require('fs');
const path = require('path');
const ini = require('ini');

// Quando empacotado com pkg, a pasta base é a do .exe; senão, a pasta atual
const baseDir = process.pkg ? path.dirname(process.execPath) : process.cwd();

function loadConfig() {
  const file = path.join(baseDir, 'config.ini');
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo de configuração não encontrado: ${file}`);
  }

  const cfg = ini.parse(fs.readFileSync(file, 'utf8'));

  const get = (section, key, fallback) => {
    const value = cfg[section]?.[key];
    if (value === undefined || value === '') {
      if (fallback !== undefined) return fallback;
      throw new Error(`Configuração ausente: [${section}] ${key}`);
    }
    return String(value).trim();
  };

  const setores = get('sync', 'setores')
    .split(',')
    .map((s) => Number(s.trim()));

  if (setores.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new Error('[sync] setores deve ser uma lista de inteiros, ex: 1,2,3');
  }

  // Códigos de empresa são texto (preservam o zero à esquerda: "01")
  const empresas = get('sync', 'empresa')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (empresas.length === 0) {
    throw new Error('[sync] empresa deve informar ao menos uma empresa, ex: 01 ou 01,02');
  }

  const intervaloMinutos = Number(get('sync', 'intervalo_minutos'));
  const lote = Number(get('sync', 'lote'));
  if (!(intervaloMinutos > 0) || !(lote > 0)) {
    throw new Error('[sync] intervalo_minutos e lote devem ser maiores que zero');
  }

  return {
    baseDir,
    firebird: {
      host: get('firebird', 'host'),
      port: Number(get('firebird', 'port')),
      database: get('firebird', 'database'),
      user: get('firebird', 'user'),
      password: get('firebird', 'password'),
      charset: get('firebird', 'charset', 'WIN1252'),
    },
    api: {
      url: get('api', 'url').replace(/\/$/, ''),
      password: get('api', 'password'),
    },
    cliente: get('cliente', 'nome'),
    sync: {
      empresas,
      setores,
      intervaloMinutos,
      lote,
    },
  };
}

module.exports = { loadConfig };
