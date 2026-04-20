#!/usr/bin/env node

import { execSync } from 'node:child_process';

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const deployVercelProject = (projectName, scope) => {
  console.log(`[auto-push-deploy] Deploying ${projectName}...`);
  run(`vercel link --yes --scope ${scope} --project ${projectName}`);
  run(`vercel deploy --prod --yes --scope ${scope}`);
  console.log(`[auto-push-deploy] ${projectName} deployed.`);
};

const main = async () => {
  await readStdin();

  try {
    try {
      run('git rev-parse --is-inside-work-tree');
    } catch {
      console.log('[auto-push-deploy] Not a git repository, skip.');
      return;
    }

    const branch = run('git branch --show-current');
    if (!branch) {
      console.log('[auto-push-deploy] Cannot detect current branch, skip.');
      return;
    }

    const status = run('git status --porcelain');
    if (!status) {
      console.log('[auto-push-deploy] No code changes, skip push/deploy.');
      return;
    }

    run('git add -A');
    const message = `chore: auto sync and deploy (${new Date().toISOString()})`;
    run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    run(`git push origin ${branch}`);
    console.log(`[auto-push-deploy] Pushed branch ${branch}.`);

    const scope = process.env.VERCEL_SCOPE || 'anhvh6s-projects';
    deployVercelProject('taophacdot4', scope);
    deployVercelProject('phacdo4', scope);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[auto-push-deploy] Error: ${msg}`);
  }
};

main();

