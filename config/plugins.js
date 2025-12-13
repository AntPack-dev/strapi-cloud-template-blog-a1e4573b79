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
    upload: {
      config: {
        provider: "provider-upload-aws-s3-cf",
        providerOptions: {
          s3Options: {
            accessKeyId: env("AWS_ACCESS_KEY_ID"),
            secretAccessKey: env("AWS_ACCESS_SECRET"),
            region: env("AWS_REGION"),
            params: {
              signedUrlExpires: env("AWS_SIGNED_URL_EXPIRES", 15 * 60),
              Bucket: env("AWS_BUCKET"),
            },
            cdn: env("AWS_CDN"),
          },
        },
      },
    },
  };
};