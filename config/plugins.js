// module.exports = () => ({});

module.exports = ({ env }) => {
  // Log de configuración de S3 al iniciar
  const s3Config = {
    provider: 'aws-s3',
    bucket: env('AWS_BUCKET'),
    region: env('AWS_REGION'),
    secretKey: env('AWS_ACCESS_KEY_ID'),
    accessKey: env('AWS_ACCESS_SECRET'),
    cdn: env('RESOURCES_CDN'),
  };

  console.log('[S3 Config] Configuración de AWS S3:', {
    ...s3Config,
    secretKey: s3Config.secretKey ? `${s3Config.secretKey.slice(0, 4)}...${s3Config.secretKey.slice(-4)}` : 'No configurado',
    accessKey: s3Config.accessKey ? `${s3Config.accessKey.slice(0, 4)}...${s3Config.accessKey.slice(-4)}` : 'No configurado',
  });

  return {
    documentation: {
      enabled: true,
    },
    // Deshabilitar Strapi Cloud para usar AWS S3
    cloud: {
      enabled: false,
    },
    upload: {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: env('RESOURCES_CDN'),
          s3Options: {
            credentials: {
              accessKeyId: env('AWS_ACCESS_KEY_ID'),
              secretAccessKey: env('AWS_ACCESS_SECRET'),
            },
            region: env('AWS_REGION'),
            params: {
              Bucket: env('AWS_BUCKET'),
            },
            // Agregar timeout para S3
            httpOptions: {
              timeout: 300000, // 5 minutos
              connectTimeout: 60000, // 1 minuto
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