// Forzar carga de variables de entorno
require('dotenv').config();

const { Strategy: GoogleStrategy } = require('passport-google-oauth2');
const { Strategy: FacebookStrategy } = require('passport-facebook');

module.exports = ({ env }) => {
  // Debug: Verificar variables de entorno
  console.log('=== Debug Variables de Entorno en production/plugins.js ===');
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
  console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
  
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
    auth: {
      providers: [
        {
          uid: 'google',
          displayName: 'Google',
          icon: 'https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Google-512.png',
          createStrategy: (strapi) => new GoogleStrategy(
            {
              clientID: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              scope: [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
              ],
              callbackURL: 'http://localhost:4060/en/auth/google/callback',
            },
            (request, accessToken, refreshToken, profile, done) => {
              done(null, {
                email: profile.email,
                firstname: profile.given_name,
                lastname: profile.family_name,
                provider: 'google',
                providerId: profile.id,
                imageUrl: profile.picture,
              });
            }
          ),
        },
        {
          uid: 'facebook',
          displayName: 'Facebook',
          icon: 'https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Facebook-512.png',
          createStrategy: (strapi) => new FacebookStrategy(
            {
              clientID: process.env.FACEBOOK_APP_ID,
              clientSecret: process.env.FACEBOOK_APP_SECRET,
              scope: ['email'],
              callbackURL: 'http://localhost:4060/en/auth/facebook/callback',
              profileFields: ['id', 'displayName', 'name', 'emails', 'photos'],
            },
            (request, accessToken, refreshToken, profile, done) => {
              done(null, {
                email: profile.emails ? profile.emails[0].value : null,
                firstname: profile.name ? profile.name.givenName : null,
                lastname: profile.name ? profile.name.familyName : null,
                provider: 'facebook',
                providerId: profile.id,
                imageUrl: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
              });
            }
          ),
        },
      ],
    },
  };
};