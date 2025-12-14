// module.exports = [
//   'strapi::logger',
//   'strapi::errors',
//   'strapi::security',
//   'strapi::cors',
//   'strapi::poweredBy',
//   'strapi::query',
//   'strapi::body',
//   'strapi::session',
//   'strapi::favicon',
//   'strapi::public',
// ];

module.exports = ({ env }) => {
  // Construir lista de fuentes permitidas para imágenes y medios
  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    // S3 bucket directo
    `${env('AWS_BUCKET')}.s3.${env('AWS_REGION')}.amazonaws.com`,
    // CDN personalizado
    env('RESOURCES_CDN'),
    // Strapi Cloud media storage (para recursos cargados antes de configurar S3)
    'https://*.media.strapiapp.com',
    '*.media.strapiapp.com',
  ].filter(Boolean); // Eliminar valores undefined/null

  const mediaSrc = [
    "'self'",
    'data:',
    'blob:',
    // S3 bucket directo
    `${env('AWS_BUCKET')}.s3.${env('AWS_REGION')}.amazonaws.com`,
    // CDN personalizado
    env('RESOURCES_CDN'),
    // Strapi Cloud media storage (para recursos cargados antes de configurar S3)
    'https://*.media.strapiapp.com',
    '*.media.strapiapp.com',
  ].filter(Boolean); // Eliminar valores undefined/null

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