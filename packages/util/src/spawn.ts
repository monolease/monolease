import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {trimStdout} from './nanoSpawn.js';

const pExecFile = promisify(execFile);

/**
 * **Note that encoding will always be `utf8` to simplify return type**
 *
 * todo: modify the args type to not accept encoding to avoid confusion
 */
export async function spawn(...args: Parameters<typeof pExecFile>) {
  const {stdout, stderr} = await pExecFile(args[0], args[1], {
    ...args[2],
    encoding: 'utf8',
  });

  const trimmedStdout = trimStdout(stdout);

  return {stdout: trimmedStdout, stderr};
}
