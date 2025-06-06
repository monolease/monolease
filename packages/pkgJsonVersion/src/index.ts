import {isObject} from '@monolease/util';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

interface Workspace {
  dir: string;
  /**
   * The version to set in the package.json file.
   */
  version: string;
}

export default async function updatePkgJsonVersions(workspaces: Workspace[]) {
  for (const workspace of workspaces) {
    const pkgJsonPath = join(workspace.dir, 'package.json');
    const fileString = await readFile(pkgJsonPath, 'utf8');
    const pkgJson = JSON.parse(fileString) as unknown;

    if (!isObject(pkgJson)) {
      throw new Error(`Expected ${pkgJsonPath} to be an object`);
    }

    const newPkgJson = {
      ...pkgJson,
      version: workspace.version,
    };

    const newPkgJsonString = JSON.stringify(newPkgJson, null, 2);
    await writeFile(pkgJsonPath, newPkgJsonString, 'utf8');
  }
}
