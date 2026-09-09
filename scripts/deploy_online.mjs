import { execSync } from 'child_process';

console.log(`
=============================================================================
   🚀 DEPLOY EM PRODUÇÃO: CASA DO LAGO -> POCKETBASE & COOLIFY
=============================================================================
`);

function run(cmd, desc) {
  console.log(`\n[+] ${desc}...`);
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\n❌ Falha em: ${desc}`);
    process.exit(1);
  }
}

try {
  // 1. Validação de Lint / TypeScript
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  run(`${npmCmd} run lint`, 'Verificando tipagem TypeScript');

  // 2. Build de Produção
  run(`${npmCmd} run build`, 'Compilando bundle de produção com Vite');

  // 3. Adicionar arquivos ao Git
  run('git add -A', 'Adicionando arquivos modificados ao Git');

  // 4. Commit
  const commitMsg = "feat(database): migrate Casa do Lago to PocketBase self-hosted on Coolify";
  try {
    run(`git commit -m "${commitMsg}"`, 'Criando commit de versão');
  } catch (e) {
    console.log('Nenhuma nova alteração para commit.');
  }

  // 5. Push para GitHub
  run('git push origin main', 'Enviando alterações para o repositório GitHub');

  console.log(`
=============================================================================
   🎉 DEPLOY CONCLUÍDO COM SUCESSO!
   O Coolify detectará o commit no GitHub e atualizará a aplicação online.
=============================================================================
`);
} catch (err) {
  console.error('\n❌ Erro durante o deploy:', err.message);
  process.exit(1);
}
