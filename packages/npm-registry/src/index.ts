import {spawn} from '@monolease/util';

export interface PublishDetail {
  workspaceName: string;
  packageManager: 'yarn' | 'pnpm';
  access?: 'public' | 'restricted' | undefined;
  tag?: string | undefined;
}

export default async function publish(publishDetails: PublishDetail[]) {
  for (const publishDetail of publishDetails) {
    const {
      workspaceName,
      packageManager,
      access = 'public',
      tag = 'latest',
    } = publishDetail;

    switch (packageManager) {
      case 'yarn': {
        const args: string[] = [
          'workspace',
          workspaceName,
          'npm',
          'publish',
          '--access',
          access,
          '--tag',
          tag,
        ];

        await spawn('yarn', args, undefined);

        break;
      }
      case 'pnpm': {
        const args: string[] = [
          '--filter',
          workspaceName,
          'publish',
          '--access',
          access,
          '--tag',
          tag,
          /**
           * Pnpm checks whether we are on the `publish branch` (defaults to `master` or `main`)
           * and whether the local branch is clean and up-to-date with the remote.
           * Since we are doing releases from other branches and in most cases have uncommitted changes
           * (the version bumps in package.json), we need to disable these checks.
           * Future improvement could be to set the `publish branch` to the current branch,
           * and check whether there are other changes than the ones we are about to publish.
           * See: https://pnpm.io/cli/publish
           */
          '--no-git-checks',
        ];

        await spawn('pnpm', args, undefined);

        break;
      }
      default:
        packageManager satisfies never;
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unsupported package manager: ${packageManager}`);
    }

    console.log(
      `Published workspace "${workspaceName}" with access "${access}" and tag "${tag}"`,
    );
  }
}
