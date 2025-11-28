import {getCurrentBranch, getRootDir, listTags} from './utils/git.js';
import {addLatestTags, createTags, parseReleaseTags} from './utils/tags.js';
import {addBumpedWorkspaceDeps, listWorkspaces} from './utils/workspaces.js';
import {
  addBumpLevels,
  addConventionalCommits,
} from './utils/conventionalCommit.js';
import {addWorkspaceDeps} from './utils/pkgJson.js';
import {addNextVersions} from './utils/semver.js';
import type {ConfigInput, PackageManager} from './types.js';
import {validateConfig} from './utils/config.js';
import {parseConfig} from './utils/parsers.js';
export type {ConfigInput, ConventionalCommit} from './types.js';

export interface RunParams {
  config: ConfigInput;
  packageManager: PackageManager;
  cwd?: string;
}

export default async function run({
  config: configInput,
  packageManager,
  cwd,
}: RunParams) {
  const config = parseConfig(configInput);
  const gitRootDir = await getRootDir(cwd);
  const currentBranch = await getCurrentBranch(gitRootDir);
  validateConfig({config, currentBranch});
  const onStableBranch = config.stable.branch === currentBranch;
  const releaseTags = parseReleaseTags(await listTags(undefined, gitRootDir));
  const workspaces = await listWorkspaces({
    rootDir: gitRootDir,
    packageManager,
  });
  const withWorkspaceDeps = addWorkspaceDeps({workspaces});
  const withLatestTags = addLatestTags({
    config,
    releaseTags,
    workspaces: withWorkspaceDeps,
  });
  const withCommits = await addConventionalCommits({
    workspaces: withLatestTags,
    cwd: gitRootDir,
  });
  const withBumpLevels = addBumpLevels({
    workspaces: withCommits,
    onStableBranch,
  });
  const withBumpedWorkspaceDeps = addBumpedWorkspaceDeps({
    workspaces: withBumpLevels,
  });
  const withNextVersions = addNextVersions({
    config,
    onStableBranch,
    workspaces: withBumpedWorkspaceDeps,
  });
  const withTags = await createTags({
    workspaces: withNextVersions,
    pushTags: config.pushTags,
    dryRun: config.dryRun,
    cwd: gitRootDir,
  });

  return {
    workspaces: withTags,
    onStableBranch,
  };
}
