import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * SCRIPT DE MIGRAÇÃO AUTOMATIZADA: CASA DO LAGO
 * SUPABASE CLOUD (pbukagdgmzeosugndcat.supabase.co) -> POCKETBASE (COOLIFY)
 */

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [k, ...v] = arg.slice(2).split('=');
      args[k] = v.length ? v.join('=') : true;
    }
  }
  return args;
}

const args = parseArgs();

if (args['help'] || args['h']) {
  console.log(`
=============================================================================
   MIGRAÇÃO AUTOMATIZADA SUPABASE CLOUD -> POCKETBASE: CASA DO LAGO
=============================================================================

Uso:
  node scripts/migrate_casa_do_lago.mjs [opções]

Opções:
  --pb-url=<url>         URL pública do PocketBase (padrão: https://pb-casadolago.janagencia.com.br)
  --pb-email=<email>     E-mail superuser do PocketBase (padrão: mccley.1@gmail.com)
  --pb-pass=<senha>      Senha superuser do PocketBase (padrão: 082025mccley)
  --supabase-url=<url>   URL da API Supabase (padrão: https://pbukagdgmzeosugndcat.supabase.co)
  --supabase-key=<key>   Anon Key do Supabase Cloud
  --backup-file=<path>   Caminho para arquivo local de backup (opcional)
  --help                 Exibe esta mensagem de ajuda
`);
  process.exit(0);
}

const PB_URL = (args['pb-url'] || process.env.VITE_POCKETBASE_URL || 'https://pb-casadolago.janagencia.com.br').replace(/\/$/, '');
const PB_EMAIL = args['pb-email'] || process.env.PB_EMAIL || 'mccley.1@gmail.com';
const PB_PASS = args['pb-pass'] || process.env.PB_PASS || '082025mccley';
const SUPABASE_URL = (args['supabase-url'] || process.env.VITE_SUPABASE_URL || 'https://pbukagdgmzeosugndcat.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = args['supabase-key'] || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_LyW_MBcKUkPcdvdOfwtozg_A-eoHC9C';

export function toPocketBaseId(id) {
  if (!id) return crypto.randomBytes(8).toString('hex').slice(0, 15);
  const clean = String(id).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.length === 15) return clean;
  return crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 15);
}

// 1. Autenticação no PocketBase
async function authenticatePB() {
  console.log(`\n[1/5] Autenticando no PocketBase em ${PB_URL}...`);
  
  // Superuser v0.23+
  try {
    const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS })
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`✓ Autenticado como Superuser (${data.record?.email || PB_EMAIL})`);
      return data.token;
    }
  } catch (err) {}

  // Fallback admins legado
  try {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS })
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`✓ Autenticado como Admin legado (${data.admin?.email || PB_EMAIL})`);
      return data.token;
    }
  } catch (err) {}

  throw new Error(`Falha ao autenticar no PocketBase (${PB_URL}). Certifique-se de que o serviço no Coolify está ativo com o domínio configurado e o superusuário ${PB_EMAIL} criado.`);
}

// 2. Garantir criação das coleções no PocketBase
async function ensureCollection(token, schemaDef) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': token };

  const checkRes = await fetch(`${PB_URL}/api/collections/${schemaDef.name}`, { headers });
  if (checkRes.ok) {
    console.log(`- Coleção '${schemaDef.name}' já existe. Atualizando permissões...`);
    await fetch(`${PB_URL}/api/collections/${schemaDef.name}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        listRule: schemaDef.listRule,
        viewRule: schemaDef.viewRule,
        createRule: schemaDef.createRule,
        updateRule: schemaDef.updateRule,
        deleteRule: schemaDef.deleteRule,
        fields: schemaDef.fields
      })
    });
    return;
  }

  const createRes = await fetch(`${PB_URL}/api/collections`, {
    method: 'POST',
    headers,
    body: JSON.stringify(schemaDef)
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.warn(`Aviso ao criar '${schemaDef.name}': ${err}`);
  } else {
    console.log(`✓ Coleção '${schemaDef.name}' criada com sucesso.`);
  }
}

async function setupCollections(token) {
  console.log(`\n[2/5] Configurando coleções da Casa do Lago no PocketBase...`);

  // Despesas (Saídas)
  await ensureCollection(token, {
    name: 'expenses',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'original_id', type: 'text', required: false },
      { name: 'date', type: 'text', required: true },
      { name: 'category', type: 'text', required: true },
      { name: 'local', type: 'text', required: false },
      { name: 'value', type: 'number', required: true },
      { name: 'paymentMethod', type: 'text', required: true },
      { name: 'installments', type: 'number', required: false },
      { name: 'donor', type: 'text', required: false },
      { name: 'observation', type: 'text', required: false },
      { name: 'isFixed', type: 'bool', required: false },
      { name: 'status', type: 'text', required: false },
      { name: 'receipt_url', type: 'text', required: false },
      { name: 'createdBy', type: 'text', required: false },
      { name: 'createdAt', type: 'text', required: false },
      { name: 'user_id', type: 'text', required: false }
    ]
  });

  // Entradas (Aportes)
  await ensureCollection(token, {
    name: 'incomes',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'original_id', type: 'text', required: false },
      { name: 'date', type: 'text', required: true },
      { name: 'value', type: 'number', required: true },
      { name: 'description', type: 'text', required: false },
      { name: 'isCaixa', type: 'bool', required: false },
      { name: 'createdBy', type: 'text', required: false },
      { name: 'createdAt', type: 'text', required: false },
      { name: 'user_id', type: 'text', required: false }
    ]
  });

  // Pagamentos de Sócios
  await ensureCollection(token, {
    name: 'payments',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'original_id', type: 'text', required: false },
      { name: 'date', type: 'text', required: true },
      { name: 'value', type: 'number', required: true },
      { name: 'person', type: 'text', required: true },
      { name: 'createdAt', type: 'text', required: false },
      { name: 'user_id', type: 'text', required: false }
    ]
  });

  // Parcelas do Terreno
  await ensureCollection(token, {
    name: 'terreno_installments',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'original_id', type: 'text', required: false },
      { name: 'month_id', type: 'text', required: true },
      { name: 'createdAt', type: 'text', required: false }
    ]
  });
}

// 3. Extrair dados do Supabase Cloud (com fallback para backup local)
async function extractData() {
  console.log(`\n[3/5] Extraindo registros do Supabase Cloud (${SUPABASE_URL})...`);
  
  const result = {
    expenses: [],
    incomes: [],
    payments: [],
    terreno_installments: []
  };

  const tables = ['expenses', 'incomes', 'payments', 'terreno_installments'];

  try {
    for (const table of tables) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        result[table] = await res.json();
        console.log(`✓ ${table}: ${result[table].length} registros obtidos do Supabase Cloud.`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    }
    return result;
  } catch (err) {
    console.warn(`⚠️ Não foi possível consultar o Supabase Cloud diretamente (${err.message}).`);
    console.log(`Tentando carregar arquivo de backup mais recente em backups/...`);

    const backupDir = path.join(process.cwd(), 'backups');
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
      if (files.length > 0) {
        const latestBackup = path.join(backupDir, files[0]);
        console.log(`✓ Usando backup local: ${latestBackup}`);
        const content = JSON.parse(fs.readFileSync(latestBackup, 'utf-8'));
        return content.tables || result;
      }
    }
    throw new Error('Nenhum dado disponível no Supabase Cloud ou no diretório de backups.');
  }
}

// 4. Inserir dados no PocketBase
async function migrateCollection(token, collectionName, items, transformFn) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': token };
  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const payload = transformFn(item);
    const pbId = payload.id;

    try {
      const checkRes = await fetch(`${PB_URL}/api/collections/${collectionName}/records/${pbId}`, { headers });
      if (checkRes.ok) {
        await fetch(`${PB_URL}/api/collections/${collectionName}/records/${pbId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        });
        updated++;
      } else {
        const createRes = await fetch(`${PB_URL}/api/collections/${collectionName}/records`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        if (createRes.ok) {
          inserted++;
        } else {
          const err = await createRes.text();
          console.warn(`Erro ao inserir em ${collectionName} (${pbId}): ${err}`);
        }
      }
    } catch (e) {
      console.warn(`Falha na gravação em ${collectionName}:`, e.message);
    }
  }

  console.log(`✓ '${collectionName}': ${inserted} inseridos, ${updated} atualizados.`);
}

async function migrateData(token, data) {
  console.log(`\n[4/5] Gravando registros no PocketBase...`);

  // Expenses
  await migrateCollection(token, 'expenses', data.expenses || [], (item) => ({
    id: toPocketBaseId(item.id),
    original_id: item.id,
    date: item.date,
    category: item.category,
    local: item.local || '',
    value: Number(item.value || 0),
    paymentMethod: item.paymentMethod,
    installments: item.installments != null ? Number(item.installments) : null,
    donor: item.donor || null,
    observation: item.observation || null,
    isFixed: Boolean(item.isFixed),
    status: item.status || 'PENDING',
    receipt_url: item.receipt_url || null,
    createdBy: item.createdBy || null,
    createdAt: item.createdAt || new Date().toISOString(),
    user_id: item.user_id || null
  }));

  // Incomes
  await migrateCollection(token, 'incomes', data.incomes || [], (item) => ({
    id: toPocketBaseId(item.id),
    original_id: item.id,
    date: item.date,
    value: Number(item.value || 0),
    description: item.description || '',
    isCaixa: Boolean(item.isCaixa),
    createdBy: item.createdBy || null,
    createdAt: item.createdAt || new Date().toISOString(),
    user_id: item.user_id || null
  }));

  // Payments
  await migrateCollection(token, 'payments', data.payments || [], (item) => ({
    id: toPocketBaseId(item.id),
    original_id: item.id,
    date: item.date,
    value: Number(item.value || 0),
    person: item.person,
    createdAt: item.createdAt || new Date().toISOString(),
    user_id: item.user_id || null
  }));

  // Terreno Installments
  await migrateCollection(token, 'terreno_installments', data.terreno_installments || [], (item) => ({
    id: toPocketBaseId(`terreno-${item.id}`),
    original_id: item.id,
    month_id: item.id,
    createdAt: item.createdAt || item.created_at || new Date().toISOString()
  }));
}

// 5. Auditoria de Batimento Contábil
async function auditTotals(token, sourceData) {
  console.log(`\n[5/5] Realizando batimento matemático e contábil rigoroso...`);
  const headers = { 'Authorization': token };

  async function getPBCountAndSum(col) {
    const res = await fetch(`${PB_URL}/api/collections/${col}/records?perPage=500`, { headers });
    if (!res.ok) return { count: 0, sum: 0 };
    const json = await res.json();
    const sum = (json.items || []).reduce((acc, c) => acc + Number(c.value || 0), 0);
    return { count: json.totalItems || json.items.length, sum };
  }

  const srcExpensesSum = (sourceData.expenses || []).reduce((acc, c) => acc + Number(c.value || 0), 0);
  const srcIncomesSum = (sourceData.incomes || []).reduce((acc, c) => acc + Number(c.value || 0), 0);

  const pbExpenses = await getPBCountAndSum('expenses');
  const pbIncomes = await getPBCountAndSum('incomes');
  const pbPayments = await getPBCountAndSum('payments');
  const pbTerreno = await getPBCountAndSum('terreno_installments');

  const diffExpenses = Math.abs(srcExpensesSum - pbExpenses.sum);
  const diffIncomes = Math.abs(srcIncomesSum - pbIncomes.sum);

  console.log(`
=============================================================================
   📊 RELATÓRIO DE AUDITORIA CONTÁBIL (CASA DO LAGO)
=============================================================================

Coleção / Tabela        | Origem (Supabase)       | Destino (PocketBase)    | Status
------------------------+-------------------------+-------------------------+--------
expenses (Registros)    | ${String(sourceData.expenses.length).padEnd(23)} | ${String(pbExpenses.count).padEnd(23)} | ${sourceData.expenses.length === pbExpenses.count ? '✓ 100% OK' : '❌ DIVERGÊNCIA'}
expenses (Total R$)     | R$ ${srcExpensesSum.toFixed(2).padEnd(20)} | R$ ${pbExpenses.sum.toFixed(2).padEnd(20)} | ${diffExpenses < 0.01 ? '✓ BATIDO (R$ 0,00)' : `❌ DIFF R$ ${diffExpenses.toFixed(2)}`}
incomes (Registros)     | ${String(sourceData.incomes.length).padEnd(23)} | ${String(pbIncomes.count).padEnd(23)} | ${sourceData.incomes.length === pbIncomes.count ? '✓ 100% OK' : '❌ DIVERGÊNCIA'}
incomes (Total R$)      | R$ ${srcIncomesSum.toFixed(2).padEnd(20)} | R$ ${pbIncomes.sum.toFixed(2).padEnd(20)} | ${diffIncomes < 0.01 ? '✓ BATIDO (R$ 0,00)' : `❌ DIFF R$ ${diffIncomes.toFixed(2)}`}
payments (Registros)    | ${String(sourceData.payments.length).padEnd(23)} | ${String(pbPayments.count).padEnd(23)} | ${sourceData.payments.length === pbPayments.count ? '✓ 100% OK' : '❌ DIVERGÊNCIA'}
terreno (Parcelas)      | ${String(sourceData.terreno_installments.length).padEnd(23)} | ${String(pbTerreno.count).padEnd(23)} | ${sourceData.terreno_installments.length === pbTerreno.count ? '✓ 100% OK' : '❌ DIVERGÊNCIA'}
=============================================================================
`);

  if (diffExpenses < 0.01 && diffIncomes < 0.01 && sourceData.expenses.length === pbExpenses.count) {
    console.log(`🎉 MIGRAÇÃO 100% CONCLUÍDA E VALIDADA COM BATIMENTO CENTAVO POR CENTAVO!`);
  } else {
    console.warn(`⚠️ Atenção: foram encontradas diferenças na contagem ou no saldo financeiro.`);
  }
}

async function main() {
  try {
    const token = await authenticatePB();
    await setupCollections(token);
    const sourceData = await extractData();
    await migrateData(token, sourceData);
    await auditTotals(token, sourceData);
  } catch (err) {
    console.error(`\n❌ ERRO NA MIGRAÇÃO: ${err.message}\n`);
    process.exit(1);
  }
}

main();
