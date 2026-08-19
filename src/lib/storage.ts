import 'server-only';
import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------
   Media storage, with the same two-driver pattern as the content store.

     oci   — OCI Object Storage, used when OCI_NAMESPACE and OCI_BUCKET
             are set. Required for any host with an ephemeral filesystem
             (containers, Vercel), where public/uploads does not survive
             a restart.
     local — public/uploads on disk, for development.

   The OCI SDK is imported lazily so the app starts without it configured.
-------------------------------------------------------------------*/

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export type MediaDriver = 'oci' | 'local';

export function mediaDriver(): MediaDriver {
  return process.env.OCI_NAMESPACE && process.env.OCI_BUCKET ? 'oci' : 'local';
}

let cachedClient: any;

async function getClient() {
  if (cachedClient) return cachedClient;
  const common = await import('oci-common');
  const objectstorage = await import('oci-objectstorage');

  const keyFile = path.resolve(process.env.OCI_KEY_FILE || './oci/oci_api_key.pem');
  const privateKey = fs.readFileSync(keyFile, 'utf8');

  const provider = new common.SimpleAuthenticationDetailsProvider(
    process.env.OCI_TENANCY_OCID || '',
    process.env.OCI_USER_OCID || '',
    process.env.OCI_FINGERPRINT || '',
    privateKey,
    null,
    common.Region.fromRegionId(process.env.OCI_REGION || ''),
  );

  cachedClient = new objectstorage.ObjectStorageClient({
    authenticationDetailsProvider: provider,
  });
  return cachedClient;
}

export function publicUrl(objectName: string): string {
  const region = process.env.OCI_REGION || '';
  const ns = process.env.OCI_NAMESPACE || '';
  const bucket = process.env.OCI_BUCKET || '';
  return `https://objectstorage.${region}.oraclecloud.com/n/${ns}/b/${bucket}/o/${encodeURIComponent(objectName)}`;
}

export interface StoredFile {
  url: string;
  objectName: string;
  driver: MediaDriver;
}

export async function putFile(
  filename: string,
  body: Buffer,
  contentType: string,
): Promise<StoredFile> {
  if (mediaDriver() === 'oci') {
    const objectName = `uploads/${filename}`;
    const client = await getClient();
    await client.putObject({
      namespaceName: process.env.OCI_NAMESPACE,
      bucketName: process.env.OCI_BUCKET,
      objectName,
      putObjectBody: body,
      contentLength: body.length,
      contentType,
    });
    return { url: publicUrl(objectName), objectName, driver: 'oci' };
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), body);
  return { url: `/uploads/${filename}`, objectName: filename, driver: 'local' };
}

export async function deleteFile(item: { url: string; objectName?: string }): Promise<void> {
  if (mediaDriver() === 'oci' && item.url.startsWith('http')) {
    const client = await getClient();
    const objectName =
      item.objectName || decodeURIComponent(item.url.split('/o/').pop() || '');
    if (!objectName) return;
    await client.deleteObject({
      namespaceName: process.env.OCI_NAMESPACE,
      bucketName: process.env.OCI_BUCKET,
      objectName,
    });
    return;
  }
  try {
    fs.unlinkSync(path.join(process.cwd(), 'public', item.url.replace(/^\//, '')));
  } catch {
    /* already gone */
  }
}
