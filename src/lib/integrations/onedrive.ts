const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

const SCOPES = [
  'Files.Read',
  'Files.Read.All',
  'offline_access',
].join(' ');

export interface MicrosoftTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface OneDriveItem {
  id: string;
  name: string;
  file?: { mimeType: string };
  image?: { width: number; height: number };
  size: number;
  photo?: { takenDateTime?: string };
  location?: { latitude?: number; longitude?: number; altitude?: number };
  folder?: { childCount: number };
  '@microsoft.graph.downloadUrl'?: string;
}

async function getConfig() {
  const { getMicrosoftCredentials } = await import('@/lib/integrations/credentialStore');
  const creds = await getMicrosoftCredentials();
  if (!creds) {
    throw new Error(
      'Missing Microsoft OAuth configuration. Configure in Settings → Setup Wizard or set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI in .env'
    );
  }
  return creds;
}

export async function getMicrosoftAuthUrl(state?: string): Promise<string> {
  const { clientId, redirectUri } = await getConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    response_mode: 'query',
  });

  if (state) {
    params.set('state', state);
  }

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
  const { clientId, clientSecret, redirectUri } = await getConfig();

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<MicrosoftTokens> {
  const { clientId, clientSecret } = await getConfig();

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Microsoft token: ${error}`);
  }

  return response.json();
}

export async function listFolders(
  accessToken: string,
  parentId?: string
): Promise<OneDriveItem[]> {
  const itemPath = parentId
    ? `/me/drive/items/${parentId}/children`
    : '/me/drive/root/children';

  const response = await fetch(
    `${GRAPH_API}${itemPath}?$select=id,name,folder&$top=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list OneDrive folders: ${error}`);
  }

  const data = await response.json();
  // Filter client-side — server-side $filter on folder facet causes a full index scan
  return (data.value || []).filter((item: OneDriveItem) => item.folder != null);
}

export async function listPhotosInFolder(
  accessToken: string,
  folderId: string
): Promise<OneDriveItem[]> {
  const allPhotos: OneDriveItem[] = [];
  // OneDrive Personal's Graph API returns "Operation not supported" for
  // $filter on /children — same gotcha listFolders worked around. We
  // already filter client-side below (mime starts with 'image/'), which
  // is more correct than $filter=file ne null anyway (excludes folders
  // AND non-image files like videos in one shot). Drop $filter; keep
  // $select to trim payload + ensure @microsoft.graph.downloadUrl comes
  // back.
  let nextLink: string | null =
    `${GRAPH_API}/me/drive/items/${folderId}/children?$top=200&$select=id,name,file,image,size,photo,location,@microsoft.graph.downloadUrl`;

  while (nextLink) {
    const url: string = nextLink;
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list OneDrive photos: ${error}`);
    }

    const data: { value?: OneDriveItem[]; '@odata.nextLink'?: string } = await response.json();
    const imageItems = (data.value || []).filter(
      (item: OneDriveItem) =>
        item.file?.mimeType?.startsWith('image/')
    );
    allPhotos.push(...imageItems);
    nextLink = data['@odata.nextLink'] || null;
  }

  return allPhotos;
}

export async function downloadPhoto(
  accessToken: string,
  itemId: string
): Promise<Buffer> {
  const response = await fetch(
    `${GRAPH_API}/me/drive/items/${itemId}/content`,
    { headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'follow' }
  );

  if (!response.ok) {
    throw new Error(`Failed to download OneDrive photo: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
