import {beforeEach, describe, expect, it} from 'vitest';
import {
  checkoutBranch,
  commit,
  createBranch,
  gitAdd,
  setupTestRepo,
} from './test.js';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {
  createTag,
  getCurrentBranch,
  getRootDir,
  listCommits,
  listTags,
} from './git.js';
import {join} from 'node:path';
import {gitAbbrevHashRegex} from '../constants.js';

let repoDir: string;

beforeEach(async () => {
  repoDir = await setupTestRepo();

  return async () => {
    await rm(repoDir, {recursive: true});
  };
});

describe('getRootDir', () => {
  it('should return the root git directory', async () => {
    expect(await getRootDir(repoDir)).toMatch(repoDir);
  });
});

describe('getCurrentBranch', () => {
  it('should return the current branch', async () => {
    expect(await getCurrentBranch(repoDir)).toMatch('main');
  });
});

describe('createTag', () => {
  it('should create a tag', async () => {
    await commit('feat: initial commit', repoDir);
    await createTag({name: 'v1.0.0', message: 'Initial release'}, repoDir);
    expect(await listTags(undefined, repoDir)).toStrictEqual(['v1.0.0']);
  });
});

describe('listTags', () => {
  it('should return empty array when there are no tags', async () => {
    expect(await listTags(undefined, repoDir)).toStrictEqual([]);
  });

  it('should return empty array when there are no tags on the branch', async () => {
    await commit('feat: initial commit', repoDir);
    await createBranch('beta', repoDir);
    await checkoutBranch('beta', repoDir);
    await commit('feat: beta commit', repoDir);
    await createTag({name: 'v1.0.0-beta.0', message: 'Beta release'}, repoDir);
    expect(await listTags({branch: 'main'}, repoDir)).toStrictEqual([]);
  });

  it('should return all tags when no branch is provided', async () => {
    await commit('feat: initial commit', repoDir);
    await createBranch('beta', repoDir);
    await checkoutBranch('beta', repoDir);
    await commit('feat: beta commit', repoDir);
    await createTag({name: 'v1.0.0-beta.0', message: 'Beta release'}, repoDir);
    await checkoutBranch('main', repoDir);
    await commit('feat: main commit', repoDir);
    await createTag({name: 'v1.0.0', message: 'Initial release'}, repoDir);
    expect(await listTags(undefined, repoDir)).toStrictEqual([
      'v1.0.0',
      'v1.0.0-beta.0',
    ]);
  });

  it('should only return tags that are reachable from the branch', async () => {
    await commit('feat: initial commit', repoDir);
    await createBranch('beta', repoDir);
    await checkoutBranch('beta', repoDir);
    await commit('feat: beta commit', repoDir);
    await createTag({name: 'v1.0.0-beta.0', message: 'Beta release'}, repoDir);
    await checkoutBranch('main', repoDir);
    await commit('feat: main commit', repoDir);
    await createTag({name: 'v1.0.0', message: 'Initial release'}, repoDir);
    expect(await listTags({branch: 'beta'}, repoDir)).toStrictEqual([
      'v1.0.0-beta.0',
    ]);
  });

  it('should only return tags that match the pattern', async () => {
    await commit('feat: initial commit', repoDir);
    await createTag({name: 'v1.0.0', message: 'Initial release'}, repoDir);
    await createTag({name: 'v1.0.1', message: 'Patch release'}, repoDir);
    await createTag({name: 'v1.1.0', message: 'Minor release'}, repoDir);
    expect(await listTags({pattern: 'v1.0.*'}, repoDir)).toStrictEqual([
      'v1.0.0',
      'v1.0.1',
    ]);
  });
});

describe('listCommits', () => {
  it('lists commits', async () => {
    await commit('feat: initial commit', repoDir);
    await commit('feat: second commit', repoDir);
    expect(await listCommits(undefined, repoDir)).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: second commit',
        body: undefined,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: initial commit',
        body: undefined,
      },
    ]);
  });

  it('lists commits since a tag', async () => {
    await commit('feat: initial commit', repoDir);
    await createTag({name: 'v1.0.0', message: 'Initial release'}, repoDir);
    await commit('feat: second commit', repoDir);
    expect(
      await listCommits({revisionRange: 'v1.0.0..HEAD'}, repoDir),
    ).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(/[a-f0-9]{7}/),
        subject: 'feat: second commit',
        body: undefined,
      },
    ]);
  });

  it('only lists commits that are reachable from the given branch', async () => {
    await commit('feat: initial commit', repoDir);
    await createBranch('beta', repoDir);
    await checkoutBranch('beta', repoDir);
    await commit('feat: beta commit', repoDir);
    expect(await listCommits({revisionRange: 'main'}, repoDir)).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: initial commit',
        body: undefined,
      },
    ]);
  });

  it('only lists commits that are reachable from the given branch and since a tag', async () => {
    await commit('feat: initial commit', repoDir);
    await createTag({name: 'v1.0.0', message: 'Initial release'}, repoDir);
    await commit('feat: second commit', repoDir);
    await createBranch('beta', repoDir);
    await checkoutBranch('beta', repoDir);
    await commit('feat: beta commit', repoDir);
    expect(
      await listCommits({revisionRange: 'v1.0.0..main'}, repoDir),
    ).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: second commit',
        body: undefined,
      },
    ]);
  });

  it('only lists commits that are reachable from the current branch and since a tag', async () => {
    await commit('feat: initial commit', repoDir);
    await createTag({name: 'v1.0.0', message: 'Initial release'}, repoDir);
    await commit('feat: second commit', repoDir);
    await createBranch('beta', repoDir);
    await checkoutBranch('beta', repoDir);
    await commit('feat: beta commit', repoDir);
    expect(
      await listCommits({revisionRange: 'v1.0.0..HEAD'}, repoDir),
    ).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: beta commit',
        body: undefined,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: second commit',
        body: undefined,
      },
    ]);
  });

  it('only lists commits that touch the given paths', async () => {
    const dir = join(repoDir, 'packages', 'a');
    await writeFile(join(repoDir, 'index.ts'), `console.log('Hello, world!');`);
    await gitAdd({all: true}, repoDir);
    await commit('feat: initial commit', repoDir);
    await mkdir(dir, {recursive: true});
    await writeFile(join(dir, 'index.ts'), `console.log('Hello, world!');`);
    await gitAdd({all: true}, repoDir);
    await commit('feat: second commit', repoDir);
    expect(await listCommits({paths: [dir]}, repoDir)).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: second commit',
        body: undefined,
      },
    ]);
  });

  it('lists commits with body', async () => {
    await commit('feat: initial commit\n\nThis is the body', repoDir);
    expect(await listCommits(undefined, repoDir)).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: initial commit',
        body: 'This is the body',
      },
    ]);
  });

  it('lists commits with multi paragraph body', async () => {
    await commit(
      'feat: initial commit\n\nThis is the body\n\nThis is the second paragraph',
      repoDir,
    );
    expect(await listCommits(undefined, repoDir)).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: initial commit',
        body: 'This is the body\n\nThis is the second paragraph',
      },
    ]);
  });

  it('returns empty array when there are no commits', async () => {
    expect(await listCommits(undefined, repoDir)).toStrictEqual([]);
  });

  it('only lists commits on the current branch', async () => {
    await commit('feat: initial commit', repoDir);
    await createBranch('beta', repoDir);
    await checkoutBranch('beta', repoDir);
    await commit('feat: beta commit', repoDir);
    await checkoutBranch('main', repoDir);
    await commit('feat: main commit', repoDir);
    expect(await listCommits(undefined, repoDir)).toStrictEqual([
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: main commit',
        body: undefined,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        abbrevHash: expect.stringMatching(gitAbbrevHashRegex),
        subject: 'feat: initial commit',
        body: undefined,
      },
    ]);
  });
});
