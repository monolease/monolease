import {glob} from 'tinyglobby';
import {loadPkgJson} from './pkgJson.js';
import {join} from 'node:path';
import type {addBumpLevels} from './conventionalCommit.js';

export async function matchWorkspacesDirs(globs: string[], rootDir: string) {
  return glob(globs, {cwd: rootDir, absolute: true, onlyDirectories: true});
}

export async function listWorkspaces(rootDir: string) {
  const rootPkgJson = await loadPkgJson(join(rootDir, 'package.json'));

  if (!rootPkgJson.workspaces) {
    throw new Error('No workspaces found in root package.json');
  }

  const workspacesDirs = await matchWorkspacesDirs(
    rootPkgJson.workspaces,
    rootDir,
  );

  return Promise.all(
    workspacesDirs.map(async dir => {
      const pkgJson = await loadPkgJson(join(dir, 'package.json'));
      return {
        name: pkgJson.name,
        dir,
        pkgJson,
      };
    }),
  );
}

interface AddBumpedWorkspaceDepsOptions {
  workspaces: Awaited<ReturnType<typeof addBumpLevels>>;
}

export function addBumpedWorkspaceDeps({
  workspaces,
}: AddBumpedWorkspaceDepsOptions) {
  const affectedWorkspaces = new Map<string, Set<string>>();
  for (const workspace of workspaces) {
    const {bumpLevel, name} = workspace;
    if (bumpLevel) {
      // Traverse up the dependency tree to find all workspaces
      // that directly or indirectly depend on the current workspace
      const stack = [name];
      const seen = new Set<string>(); // Track processed workspaces
      while (stack.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const current = stack.pop()!;
        for (const w of workspaces) {
          if (w.workspaceDependencies.includes(current)) {
            if (!affectedWorkspaces.has(w.name)) {
              affectedWorkspaces.set(w.name, new Set());
            }
            affectedWorkspaces.get(w.name)?.add(name);
            // Only push to stack if we haven't already seen this workspace
            if (!seen.has(w.name)) {
              seen.add(w.name);
              stack.push(w.name);
            }
          }
        }
      }
    }
  }

  return workspaces.map(workspace => {
    const {name} = workspace;

    return {
      ...workspace,
      bumpedWorkspaceDependencies:
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        affectedWorkspaces.has(name) ? [...affectedWorkspaces.get(name)!] : [],
    };
  });
}
