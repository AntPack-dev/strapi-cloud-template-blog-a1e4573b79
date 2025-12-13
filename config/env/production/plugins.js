module.exports = ({ env }) => {
  // Log de configuración de S3 al iniciar
  const s3Config = {
    provider: 'aws-s3',
    bucket: process.env.AWS_BUCKET,
    region: process.env.AWS_REGION,
    secretKey: process.env.AWS_ACCESS_KEY_ID,
    accessKey: process.env.AWS_ACCESS_SECRET,
    cdn: process.env.RESOURCES_CDN,
  };

  console.log('[S3 Config] Configuración de AWS S3:', {
    ...s3Config,
    secretKey: s3Config.secretKey ? `${s3Config.secretKey.slice(0, 4)}..${s3Config.secretKey.slice(-4)}` : 'No configurado',
    accessKey: s3Config.accessKey ? `${s3Config.accessKey.slice(0, 4)}..${s3Config.accessKey.slice(-4)}` : 'No configurado',
  });

  return {
    documentation: {
      enabled: true,
    },
    upload: {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: process.env.RESOURCES_CDN,
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