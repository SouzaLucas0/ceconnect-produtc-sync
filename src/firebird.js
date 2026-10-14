const Firebird = require('node-firebird');

// Tabelas do sistema do cliente (confirmar nomes em produção)
// empresas e setores vêm do .ini; setores já são inteiros validados,
// e as empresas entram como parâmetros (?)
const SQL_PRODUTOS = (empresas, setores) => `
SELECT
    PDT.ATIVO                                        AS ATIVO,
    PDG.CODIGO                                       AS CODIGOPRODUTO,
    PDG.DESCRICAO                                    AS DESCRICAOPRODUTO,
    PDG.REFERENCIA                                   AS REFERENCIA,
    (PDT.ESTDISPONIVEL / NULLIF(PDG.QTDEEMBALAGEM, 0)) AS ESTOQUEATUAL,
    PDT.PRPRATICADO                                  AS PRECOVENDA,
    MAR.DESCRICAO                                    AS DESCRICAOMARCA
FROM TESTPRODUTOGERAL PDG
LEFT OUTER JOIN TESTPRODUTO PDT ON (PDT.PRODUTO = PDG.CODIGO)
LEFT OUTER JOIN TESTSETOR SETOR ON (SETOR.EMPRESA = PDT.EMPRESA AND SETOR.CODIGO = PDT.SETOR)
LEFT OUTER JOIN TESTMARCA MAR ON (MAR.CODIGO = PDG.MARCA)
WHERE PDT.EMPRESA IN (${empresas.map(() => '?').join(',')})
  AND SETOR.CODIGO IN (${setores})
GROUP BY 1, 2, 3, 4, 5, 6, 7
`;

function attach(options) {
  return new Promise((resolve, reject) => {
    Firebird.attach(
      { ...options, lowercase_keys: false, pageSize: 4096 },
      (err, db) => (err ? reject(err) : resolve(db)),
    );
  });
}

function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// Lê os produtos do Firebird. Sempre fecha a conexão, mesmo com erro.
async function fetchProdutos(cfg) {
  const { empresas, setores } = cfg.sync;
  const sql = SQL_PRODUTOS(empresas, setores.join(','));
  const db = await attach(cfg.firebird);
  try {
    return await query(db, sql, empresas);
  } finally {
    db.detach(() => {});
  }
}

module.exports = { fetchProdutos };
