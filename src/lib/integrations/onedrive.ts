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
  folder?: { childCount: number };
  '@microsoft.graph.downloadUrl'?: string;
}

function getConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Microsoft OAuth configuration. Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI in .env'
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function getMicrosoftAuthUrl(state?: string): string {
  const { clientId, redirectUri } = getConfig();

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
  const { clientId, clientSecret, redirectUri } = getConfig();

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
  const { clientId, clientSecret } = getConfig();

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

  const response = await fetch(`${GRAPH_API}${itemPath}?$filter=folder ne null`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list OneDrive folders: ${error}`);
  }

  const data = await response.json();
  return data.value || [];
}

export async function listPhotosInFolder(
  accessToken: string,
  folderId: string
): Promise<OneDriveItem[]> {
  const allPhotos: OneDriveItem[] = [];
  let nextLink: string | null =
    `${GRAPH_API}/me/drive/items/${folderId}/children?$filter=file ne null&$top=200`;

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
