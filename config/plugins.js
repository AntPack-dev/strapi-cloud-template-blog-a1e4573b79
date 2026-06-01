module.exports = ({ env }) => {
  const resourcesCdn = env('RESOURCES_CDN');
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
        sizeLimit: 512 * 1024 * 1024,
      },
    },
    'users-permissions': {
      config: {
        register: {
          allowedFields: ['firstName', 'lastName', 'provider', 'providers', 'providerId', 'imageUrl', 'biography', 'statusProfile', 'localIntegration', 'notificationActive'],
        },
        email: {
          reset_password: {
            from: env('RESEND_EMAIL_SENDER'),
            replyTo: env('RESEND_EMAIL_SENDER'),
          },
        },
      },
      auth: {
        providers: [
          {
            uid: 'google',
            displayName: 'Google',
            icon: 'https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Google-512.png',
            enabled: true,
            createStrategy: (strapi) => {
              const GoogleStrategy = require('passport-google-oauth2').Strategy;
              return new GoogleStrategy({
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                scope: [
                  'https://www.googleapis.com/auth/userinfo.email',
                  'https://www.googleapis.com/auth/userinfo.profile',
                ],
                callbackURL: env('GOOGLE_FRONT_REDIRECT', 'http://localhost:4060/en/auth/google/callback'),
              }, (request, accessToken, refreshToken, profile, done) => {
                done(null, {
                  email: profile.email,
                  firstname: profile.given_name,
                  lastname: profile.family_name,
                  provider: 'google',
                  providerId: profile.id,
                  imageUrl: profile.picture,
                });
              });
            },
          },
          {
            uid: 'facebook',
            displayName: 'Facebook',
            icon: 'https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Facebook-512.png',
            enabled: true,
            createStrategy: (strapi) => {
              const FacebookStrategy = require('passport-facebook').Strategy;
              return new FacebookStrategy({
                clientID: process.env.FACEBOOK_APP_ID,
                clientSecret: process.env.FACEBOOK_APP_SECRET,
                scope: ['email'],
                callbackURL: env('FACEBOOK_FRONT_REDIRECT', 'http://localhost:4060/en/auth/facebook/callback'),
                profileFields: ['id', 'displayName', 'name', 'emails', 'photos'],
              }, (request, accessToken, refreshToken, profile, done) => {
                done(null, {
                  email: profile.emails ? profile.emails[0].value : null,
                  firstname: profile.name ? profile.name.givenName : null,
                  lastname: profile.name ? profile.name.familyName : null,
                  provider: 'facebook',
                  providerId: profile.id,
                  imageUrl: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
                });
              });
            },
          },
        ],
      },
    },
    email: {
      config: {
        provider: 'strapi-provider-email-resend',
        providerOptions: {
          apiKey: env('RESEND_API_KEY'),
        },
        settings: {
          defaultFrom: env('RESEND_EMAIL_SENDER'),
          defaultReplyTo: env('RESEND_EMAIL_SENDER'),
        },
      },
    },
  };
};
