import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

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

  // credit to https://github.com/sindresorhus/nano-spawn for the following line
  const trimmedStdout =
    stdout.at(-1) === '\n' ?
      stdout.slice(0, stdout.at(-2) === '\r' ? -2 : -1)
    : stdout;

  return {stdout: trimmedStdout, stderr};
}
