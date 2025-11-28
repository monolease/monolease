import {glob} from 'tinyglobby';
import {loadPkgJson} from './pkgJson.js';
import {join} from 'node:path';
import {parse} from 'yaml';
import type {addBumpLevels} from './conventionalCommit.js';
import type {PackageManager} from '../types.js';
import {readFile} from 'node:fs/promises';
import {isObject, isStringArray} from '@monolease/util';

export async function matchWorkspacesDirs(globs: string[], rootDir: string) {
  return glob(globs, {cwd: rootDir, absolute: true, onlyDirectories: true});
}

interface ListWorkspacesOptions {
  rootDir: string;
  packageManager: PackageManager;
}

export async function listWorkspaces({
  rootDir,
  packageManager,
}: ListWorkspacesOptions) {
  const workspacesGlobs = await (async () => {
    switch (packageManager) {
      case 'npm':
      case 'yarn': {
        const rootPkgJson = await loadPkgJson(join(rootDir, 'package.json'));

        if (!rootPkgJson.workspaces) {
          throw new Error('No workspaces found in root package.json');
        }
        return rootPkgJson.workspaces;
      }

      case 'pnpm': {
        const pnpmWorkspaceYamlPath = join(rootDir, 'pnpm-workspace.yaml');
        const file = await readFile(pnpmWorkspaceYamlPath, 'utf8');
        const pnpmWorkspace = parse(file) as unknown;
        if (
          !isObject(pnpmWorkspace) ||
          !isStringArray(pnpmWorkspace.packages)
        ) {
          throw new Error('No packages found in pnpm-workspace.yaml');
        }
        return pnpmWorkspace.packages;
      }
      default:
        packageManager satisfies never;
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  })();

  const workspacesDirs = await matchWorkspacesDirs(workspacesGlobs, rootDir);

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
