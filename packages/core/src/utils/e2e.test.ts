import {beforeEach, describe, expect, it} from 'vitest';
import {
  checkoutBranch,
  commit,
  createBranch,
  gitAdd,
  mergeBranch,
  setupTestRepo,
  writePkgJsonFile,
} from './test.js';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import run, {type ConfigInput} from '../index.js';
import {join} from 'node:path';
import {createTag, listTags} from './git.js';

const stableBranch = 'main';
const prereleaseBranch = 'staging';
const prereleaseIdentifier = 'rc';

let repoDir: string;

beforeEach(async () => {
  repoDir = await setupTestRepo();

  return async () => {
    await rm(repoDir, {recursive: true});
  };
});

const config: ConfigInput = {
  stable: {branch: stableBranch},
  pushTags: false,
  prerelease: {branch: prereleaseBranch, identifier: prereleaseIdentifier},
};

async function setupRootWorkspace() {
  await writePkgJsonFile(repoDir, {
    name: 'test',
    workspaces: ['packages/*'],
  });
  await gitAdd({all: true}, repoDir);
  await commit('chore: initial commit', repoDir);
  await createBranch(prereleaseBranch, repoDir);
}

async function addWorkspaces() {
  await mkdir(join(repoDir, 'packages/a'), {recursive: true});
  await mkdir(join(repoDir, 'packages/b'), {recursive: true});
  await writePkgJsonFile(join(repoDir, 'packages/a'), {
    name: 'a',
  });
  await writePkgJsonFile(join(repoDir, 'packages/b'), {
    name: 'b',
    dependencies: {
      a: 'workspace:*',
    },
  });
}

describe('e2e', () => {
  it('should have no latest version when no release tags', async () => {
    await setupRootWorkspace();
    await addWorkspaces();
    const result = await run({config, cwd: repoDir});
    for (const workspace of result.workspaces) {
      expect(workspace.latestVersion.overall).toBeUndefined();
      expect(workspace.latestVersion.prerelease).toBeUndefined();
      expect(workspace.latestVersion.stable).toBeUndefined();
    }
  });

  it('should have latest versions', async () => {
    await setupRootWorkspace();
    await addWorkspaces();
    await createTag({name: 'a@1.0.0', message: 'Initial release'}, repoDir);
    await createTag(
      {
        name: `a@1.0.0-${prereleaseIdentifier}.0`,
        message: 'Initial prerelease',
      },
      repoDir,
    );
    await createTag({name: 'b@1.0.0', message: 'Initial release'}, repoDir);
    await createTag(
      {
        name: `b@1.0.0-${prereleaseIdentifier}.0`,
        message: 'Initial prerelease',
      },
      repoDir,
    );

    const result = await run({config, cwd: repoDir});
    for (const workspace of result.workspaces) {
      expect(workspace.latestVersion.overall?.raw).toBe(
        `${workspace.name}@1.0.0`,
      );
      expect(workspace.latestVersion.stable?.raw).toBe(
        `${workspace.name}@1.0.0`,
      );
      expect(workspace.latestVersion.prerelease?.raw).toBe(
        `${workspace.name}@1.0.0-${prereleaseIdentifier}.0`,
      );
    }
  });

  it('should use 1.0.0 as first version on stable', async () => {
    await setupRootWorkspace();
    await addWorkspaces();
    await gitAdd({all: true}, repoDir);
    await commit('feat: initial commit', repoDir);
    const result = await run({config, cwd: repoDir});
    for (const workspace of result.workspaces) {
      expect(workspace.nextVersion?.raw).toBe('1.0.0');
    }
  });

  it(`should use 1.0.0-${prereleaseIdentifier}.0 as first version on prerelease`, async () => {
    await setupRootWorkspace();
    await addWorkspaces();
    await checkoutBranch(prereleaseBranch, repoDir);
    await gitAdd({all: true}, repoDir);
    await commit('feat: initial commit', repoDir);
    const result = await run({config, cwd: repoDir});
    for (const workspace of result.workspaces) {
      expect(workspace.nextVersion?.raw).toBe(
        `1.0.0-${prereleaseIdentifier}.0`,
      );
    }
  });

  it('should version correcly when merging prerelease to stable', async () => {
    await setupRootWorkspace();
    await checkoutBranch(prereleaseBranch, repoDir);
    await addWorkspaces();
    await gitAdd({all: true}, repoDir);
    await commit('feat: initial commit', repoDir);
    await run({config, cwd: repoDir});
    const prereleaseTags = await listTags(undefined, repoDir);
    expect(prereleaseTags).toStrictEqual(['a@1.0.0-rc.0', 'b@1.0.0-rc.0']);
    await checkoutBranch(stableBranch, repoDir);
    await mergeBranch(prereleaseBranch, repoDir);
    await run({config, cwd: repoDir});
    const stableTags = await listTags(undefined, repoDir);
    expect(stableTags).toStrictEqual([
      'a@1.0.0',
      'a@1.0.0-rc.0',
      'b@1.0.0',
      'b@1.0.0-rc.0',
    ]);
  });

  it('should version correcly when merging stable to non-existing prerelease ', async () => {
    await setupRootWorkspace();
    await addWorkspaces();
    await gitAdd({all: true}, repoDir);
    await commit('feat: initial commit', repoDir);
    await run({config, cwd: repoDir});
    const stableTags = await listTags(undefined, repoDir);
    expect(stableTags).toStrictEqual(['a@1.0.0', 'b@1.0.0']);
    await checkoutBranch(prereleaseBranch, repoDir);
    await mergeBranch(stableBranch, repoDir);
    await run({config, cwd: repoDir});
    const prereleaseTags = await listTags(undefined, repoDir);
    expect(prereleaseTags).toStrictEqual([
      'a@1.0.0',
      'a@1.0.1-rc.0',
      'b@1.0.0',
      'b@1.0.1-rc.0',
    ]);
  });

  it('should version correcly when merging stable to existing prerelease ', async () => {
    await setupRootWorkspace();
    await addWorkspaces();
    await gitAdd({all: true}, repoDir);
    await commit('feat: initial commit', repoDir);
    await run({config, cwd: repoDir});
    let tags = await listTags(undefined, repoDir);
    expect(tags).toStrictEqual(['a@1.0.0', 'b@1.0.0']);
    await checkoutBranch(prereleaseBranch, repoDir);
    await mergeBranch(stableBranch, repoDir);
    await writeFile(join(repoDir, 'packages/a', 'README.md'), 'test');
    await gitAdd({all: true}, repoDir);
    await commit('feat: add readme', repoDir);
    await run({config, cwd: repoDir});
    tags = await listTags(undefined, repoDir);
    expect(tags).toStrictEqual([
      'a@1.0.0',
      'a@1.1.0-rc.0',
      'b@1.0.0',
      'b@1.0.1-rc.0',
    ]);
    await checkoutBranch(stableBranch, repoDir);
    await writeFile(join(repoDir, 'packages/a', 'index.js'), 'fix');
    await gitAdd({all: true}, repoDir);
    await commit('fix: update index.js', repoDir);
    await run({config, cwd: repoDir});
    tags = await listTags(undefined, repoDir);
    expect(tags).toStrictEqual([
      'a@1.0.0',
      'a@1.0.1',
      'a@1.1.0-rc.0',
      'b@1.0.0',
      'b@1.0.1',
      'b@1.0.1-rc.0',
    ]);
    await checkoutBranch(prereleaseBranch, repoDir);
    await mergeBranch(stableBranch, repoDir);
    await run({config, cwd: repoDir});
    tags = await listTags(undefined, repoDir);
    expect(tags).toStrictEqual([
      'a@1.0.0',
      'a@1.0.1',
      'a@1.1.0-rc.0',
      'a@1.1.0-rc.1',
      'b@1.0.0',
      'b@1.0.1',
      'b@1.0.1-rc.0',
      'b@1.0.2-rc.0',
    ]);
  });

  it('should version correcly when merging stable to prerelease and adding additional commits', async () => {
    await setupRootWorkspace();
    await addWorkspaces();
    await gitAdd({all: true}, repoDir);
    await commit('feat: initial commit', repoDir);
    await run({config, cwd: repoDir});
    let tags = await listTags(undefined, repoDir);
    expect(tags).toStrictEqual(['a@1.0.0', 'b@1.0.0']);
    await writeFile(join(repoDir, 'packages/b', 'README.md'), 'test');
    await gitAdd({all: true}, repoDir);
    await commit('feat!: add readme', repoDir);
    await run({config, cwd: repoDir});
    tags = await listTags(undefined, repoDir);
    expect(tags).toStrictEqual(['a@1.0.0', 'b@1.0.0', 'b@2.0.0']);
    await checkoutBranch(prereleaseBranch, repoDir);
    await mergeBranch(stableBranch, repoDir);
    await writeFile(join(repoDir, 'packages/b', 'index.js'), 'fix');
    await gitAdd({all: true}, repoDir);
    await commit('fix: update index.js', repoDir);
    await run({config, cwd: repoDir});
    tags = await listTags(undefined, repoDir);
    expect(tags).toStrictEqual([
      'a@1.0.0',
      'a@1.0.1-rc.0',
      'b@1.0.0',
      'b@2.0.0',
      'b@2.0.1-rc.0',
    ]);
  });
});
