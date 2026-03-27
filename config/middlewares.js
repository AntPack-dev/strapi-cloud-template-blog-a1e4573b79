module.exports = ({ env }) => {
  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    `${env('AWS_BUCKET')}.s3.${env('AWS_REGION')}.amazonaws.com`,
    env('RESOURCES_CDN'),
    'https://*.media.strapiapp.com',
    '*.media.strapiapp.com',
  ].filter(Boolean);

  const mediaSrc = [
    "'self'",
    'data:',
    'blob:',
    `${env('AWS_BUCKET')}.s3.${env('AWS_REGION')}.amazonaws.com`,
    env('RESOURCES_CDN'),
    'https://*.media.strapiapp.com',
    '*.media.strapiapp.com',
  ].filter(Boolean);

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': imgSrc,
            'media-src': mediaSrc,
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    'strapi::cors',
    {
      name: 'strapi::cors',
      config: {
        origin: ['http://localhost:3000', 'http://localhost:1337', 'http://localhost:8080'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        credentials: true,
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    {
      name: 'strapi::body',
      config: {
        formLimit: '512mb',
        jsonLimit: '512mb',
        textLimit: '512mb',
        formidable: {
          maxFileSize: 512 * 1024 * 1024, // 512MB in bytes
        },
      },
    },
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
    {
      name: 'global::auth-transform',
      config: {},
    },
    {
      name: 'global::oauth-callback',
      config: {},
    },
  ];
};