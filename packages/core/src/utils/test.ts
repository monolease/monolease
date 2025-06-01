import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {git} from './git.js';
import type {PkgJson} from '../types.js';

export async function makeTempDir() {
  return mkdtemp(join(tmpdir(), 'monolease-'));
}

export async function setupTestRepo() {
  const repoDir = await makeTempDir();

  /** https://git-scm.com/docs/git#Documentation/git.txt-codeGITCONFIGGLOBALcode */
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  await git(['init'], repoDir);
  await git(['config', 'user.email', 'john@example.com'], repoDir);
  await git(['config', 'user.name', 'John Doe'], repoDir);

  return repoDir;
}

export async function writePkgJsonFile(dir: string, pkgJson: PkgJson) {
  const pkgJsonPath = join(dir, 'package.json');
  const pkgJsonContent = JSON.stringify(pkgJson, null, 2);
  await writeFile(pkgJsonPath, pkgJsonContent);
}

export async function commit(message = '', cwd?: string) {
  return git(
    ['commit', '-m', message, '--allow-empty', '--allow-empty-message'],
    cwd,
  );
}

interface GitAddOptions {
  paths?: string[];
  all?: boolean;
}

export async function gitAdd({all, paths}: GitAddOptions, cwd?: string) {
  const args = ['add'];

  if (paths) {
    args.push(...paths);
  }

  if (all) {
    args.push('--all');
  }

  return git(args, cwd);
}

export async function createBranch(name: string, cwd?: string) {
  return git(['branch', name], cwd);
}

export async function checkoutBranch(name: string, cwd?: string) {
  return git(['checkout', name], cwd);
}

export async function mergeBranch(name: string, cwd?: string) {
  return git(['merge', name], cwd);
}
