import { execFileSync } from 'node:child_process';

const target = process.argv[2];
const targets = {
  staging: { branch: 'develop', args: ['wrangler', 'deploy', '--env', 'staging'] },
  production: { branch: 'main', args: ['wrangler', 'deploy'] },
};

if (!targets[target]) {
  throw new Error('Usage: node scripts/deploy.js <staging|production>');
}

const branch = execFileSync('git', ['branch', '--show-current'], {
  encoding: 'utf8',
}).trim();
const expected = targets[target].branch;

if (branch !== expected) {
  throw new Error(`Refusing ${target} deployment from ${branch || 'detached HEAD'}; expected ${expected}.`);
}

execFileSync('npx', targets[target].args, { stdio: 'inherit' });
