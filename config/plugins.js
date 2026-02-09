const { Strategy: GoogleStrategy } = require('passport-google-oauth2');
const { Strategy: FacebookStrategy } = require('passport-facebook');

module.exports = ({ env }) => ({
  documentation: {
    enabled: true,
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
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['firstName', 'lastName', 'provider', 'providerId'],
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
            clientID: env('GOOGLE_CLIENT_ID'),
            clientSecret: env('GOOGLE_CLIENT_SECRET'),
            scope: [
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
            ],
            callbackURL: strapi.admin.services.passport.getStrategyCallbackURL('google'),
          },
          (request, accessToken, refreshToken, profile, done) => {
            done(null, {
              email: profile.email,
              firstname: profile.given_name,
              lastname: profile.family_name,
              provider: 'google',
              providerId: profile.id,
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
            clientID: env('FACEBOOK_APP_ID'),
            clientSecret: env('FACEBOOK_APP_SECRET'),
            scope: ['email'],
            callbackURL: strapi.admin.services.passport.getStrategyCallbackURL('facebook'),
            profileFields: ['id', 'displayName', 'name', 'emails'],
          },
          (request, accessToken, refreshToken, profile, done) => {
            done(null, {
              email: profile.emails ? profile.emails[0].value : null,
              firstname: profile.name ? profile.name.givenName : null,
              lastname: profile.name ? profile.name.familyName : null,
              provider: 'facebook',
              providerId: profile.id,
            });
          }
        ),
      },
    ],
  },
});