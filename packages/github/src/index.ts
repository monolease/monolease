const apiUrl = 'https://api.github.com';
const apiVersion = '2022-11-28';
const userAgent = 'monolease';

interface GitHubRelease {
  body: string;
  id: number;
  name: string;
  prerelease: boolean;
  tag_name: string;
  upload_url: string;
}

interface ApiOptions {
  apiToken: string;
  repoOwnerAndName: string;
}

interface CreateGitHubReleaseOptions {
  tagName: string;
  name: string;
  body: string;
  prerelease: boolean;
}

interface CreateGitHubReleaseParams extends ApiOptions {
  options: CreateGitHubReleaseOptions;
}

export async function createGitHubRelease({
  options,
  apiToken,
  repoOwnerAndName,
}: CreateGitHubReleaseParams) {
  const fetchUrl = `${apiUrl}/repos/${repoOwnerAndName}/releases`;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': apiVersion,
    'User-Agent': userAgent,
  };
  const body = {
    tag_name: options.tagName,
    name: options.name,
    body: options.body,
    prerelease: options.prerelease,
  };

  const response = await fetch(fetchUrl, {
    body: JSON.stringify(body),
    headers,
    method: 'POST',
  });

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Response status: ${response.status}`);
  }

  const responseJson = (await response.json()) as unknown;

  const parsedResponse = parseFetchResponse(responseJson);

  return parsedResponse;
}

interface Workspace {
  name: string;
  nextVersion: string;
  changelog: string;
  createdTag: string;
  prerelease: boolean;
}

interface CreateGitHubReleasesParams {
  workspaces: Workspace[];
  apiOptions: ApiOptions;
}

export default async function createGitHubReleases({
  workspaces,
  apiOptions,
}: CreateGitHubReleasesParams) {
  return Promise.all(
    workspaces.map(async workspace => {
      const gitHubRelease = await createGitHubRelease({
        options: {
          name: workspace.createdTag,
          tagName: workspace.createdTag,
          body: workspace.changelog,
          prerelease: workspace.prerelease,
        },
        apiToken: apiOptions.apiToken,
        repoOwnerAndName: apiOptions.repoOwnerAndName,
      });

      return {
        name: workspace.name,
        gitHubRelease,
      };
    }),
  );
}

function parseFetchResponse(response: unknown): GitHubRelease {
  if (!isObject(response)) {
    throw new Error('Expected response to be an object');
  }

  const {body, id, name, prerelease, tag_name, upload_url} = response;

  if (typeof body !== 'string') {
    throw new Error('Expected response.body to be a string');
  }

  if (typeof id !== 'number') {
    throw new Error('Expected response.id to be a number');
  }

  if (typeof name !== 'string') {
    throw new Error('Expected response.name to be a string');
  }

  if (typeof prerelease !== 'boolean') {
    throw new Error('Expected response.prerelease to be a boolean');
  }

  if (typeof tag_name !== 'string') {
    throw new Error('Expected response.tag_name to be a string');
  }

  if (typeof upload_url !== 'string') {
    throw new Error('Expected response.upload_url to be a string');
  }

  return {
    body,
    id,
    name,
    prerelease,
    tag_name,
    upload_url,
  };
}

function isObject(x: unknown): x is Record<PropertyKey, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
