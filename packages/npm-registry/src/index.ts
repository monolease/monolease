import {spawn} from '@monolease/util';

export interface PublishDetail {
  workspaceName: string;
  access?: 'public' | 'restricted' | undefined;
  tag?: string | undefined;
}

// todo: Add support for other package managers than yarn berry
export default async function publish(publishDetails: PublishDetail[]) {
  for (const publishDetail of publishDetails) {
    const {workspaceName, access = 'public', tag = 'latest'} = publishDetail;

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

    console.log(
      `Published workspace "${workspaceName}" with access "${access}" and tag "${tag}"`,
    );
  }
}
