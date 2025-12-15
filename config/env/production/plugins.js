module.exports = ({ env }) => {
  // Log de configuración de S3 al iniciar
  const resourcesCdn = process.env.RESOURCES_CDN;
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
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_ACCESS_SECRET,
            },
            region: process.env.AWS_REGION,
            params: {
              Bucket: process.env.AWS_BUCKET,
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