/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },

  // oracledb and the OCI SDK are Node-only and must never be bundled by
  // the Next compiler — they load native/optional deps at runtime.
  serverExternalPackages: ['oracledb', 'oci-common', 'oci-objectstorage'],

  // Uploads added after a production build are not in the static /public
  // snapshot. Static files are checked first; only misses reach the handler.
  async rewrites() {
    return {
      afterFiles: [{ source: '/uploads/:path*', destination: '/api/uploads/:path*' }],
    };
  },
};
export default nextConfig;
