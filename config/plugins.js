module.exports = ({ env }) => {
  // Log de configuración de S3 al iniciar
  const resourcesCdn = env('RESOURCES_CDN');
  // Asegurar que el CDN sea una URL absoluta
  const baseUrl = resourcesCdn && !resourcesCdn.startsWith('http') 
    ? `https://${resourcesCdn}` 
    : resourcesCdn;

  return {
    documentation: {
      enabled: true,
    },
    upload: {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: baseUrl,
          s3Options: {
            credentials: {
              accessKeyId: env('AWS_ACCESS_KEY_ID'),
              secretAccessKey: env('AWS_ACCESS_SECRET'),
            },
            region: env('AWS_REGION'),
            params: {
              Bucket: env('AWS_BUCKET'),
            },
          },
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    },
  };
};