// Forzar carga de variables de entorno
require('dotenv').config();

const { Strategy: GoogleStrategy } = require('passport-google-oauth2');
const { Strategy: FacebookStrategy } = require('passport-facebook');

module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    options: {
      expiresIn: '7d',
    },
    providers: [
      {
        uid: 'google',
        displayName: 'Google',
        icon: 'https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Google-512.png',
        createStrategy: (strapi) => new GoogleStrategy({
          clientID: env('GOOGLE_CLIENT_ID'),
          clientSecret: env('GOOGLE_CLIENT_SECRET'),
          scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
          ],
          callbackURL: strapi.admin.services.passport.getStrategyCallbackURL('google'),
        }, (request, accessToken, refreshToken, profile, done) => {
          done(null, {
            email: profile.email,
            firstname: profile.given_name,
            lastname: profile.family_name,
            provider: 'google',
            providerId: profile.id,
            imageUrl: profile.picture,
          });
        }),
      },
      {
        uid: 'facebook',
        displayName: 'Facebook',
        icon: 'https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Facebook-512.png',
        createStrategy: (strapi) => new FacebookStrategy({
          clientID: env('FACEBOOK_APP_ID'),
          clientSecret: env('FACEBOOK_APP_SECRET'),
          scope: ['email'],
          callbackURL: strapi.admin.services.passport.getStrategyCallbackURL('facebook'),
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
        }),
      },
    ],
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
    timeout: env.int('TRANSFER_TIMEOUT', 300000), // 5 minutos (300000 ms)
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  theme: {
    light: {},
    dark: {},
  },
});
