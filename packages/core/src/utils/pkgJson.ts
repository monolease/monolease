import {readFile} from 'node:fs/promises';
import type {listWorkspaces} from './workspaces.js';
import type {PkgJson} from '../types.js';
import {parsePkgJson} from './parsers.js';

export async function loadPkgJson(path: string): Promise<PkgJson> {
  const fileString = await readFile(path, 'utf8');
  return parsePkgJson(JSON.parse(fileString));
}

interface ListWorkspaceDependenciesOptions {
  pkgJson: PkgJson;
  workspaces: string[];
}

export function listWorkspaceDependencies({
  pkgJson,
  workspaces,
}: ListWorkspaceDependenciesOptions) {
  const dependencies = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
    ...pkgJson.peerDependencies,
  };

  const workspaceDependencies: string[] = [];

  for (const dep of Object.keys(dependencies)) {
    if (workspaces.includes(dep)) {
      workspaceDependencies.push(dep);
    }
  }

  return workspaceDependencies;
}

interface AddWorkspaceDepsOptions {
  workspaces: Awaited<ReturnType<typeof listWorkspaces>>;
}

export function addWorkspaceDeps({workspaces}: AddWorkspaceDepsOptions) {
  return workspaces.map(workspace => {
    const workspaceDependencies = listWorkspaceDependencies({
      pkgJson: workspace.pkgJson,
      workspaces: workspaces.map(w => w.pkgJson.name),
    });

    return {
      ...workspace,
      workspaceDependencies,
    };
  });
}
