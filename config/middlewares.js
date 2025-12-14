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
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};