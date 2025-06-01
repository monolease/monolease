import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

interface Workspace {
  dir: string;
  nextVersion: string;
}

export default async function updatePkgJsonVersions(workspaces: Workspace[]) {
  for (const workspace of workspaces) {
    if (workspace.nextVersion) {
      const pkgJsonPath = join(workspace.dir, 'package.json');
      const fileString = await readFile(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(fileString) as unknown;

      if (!isObject(pkgJson)) {
        throw new Error(`Expected ${pkgJsonPath} to be an object`);
      }

      const newPkgJson = {
        ...pkgJson,
        version: workspace.nextVersion,
      };

      const newPkgJsonString = JSON.stringify(newPkgJson, null, 2);
      await writeFile(pkgJsonPath, newPkgJsonString, 'utf8');
    }
  }
}

export function isObject(x: unknown): x is Record<PropertyKey, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
