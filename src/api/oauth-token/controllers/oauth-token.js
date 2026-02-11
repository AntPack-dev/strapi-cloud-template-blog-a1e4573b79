'use strict';

module.exports = {
  async googleCallback(ctx) {
    const { access_token } = ctx.query;

    if (!access_token) {
      return ctx.badRequest('Access token is required');
    }

    try {
      // Obtener perfil de Google usando el access_token
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to get user profile from Google');
      }

      const profile = await profileResponse.json();

      if (!profile.email) {
        return ctx.badRequest('Unable to get email from Google profile');
      }

      // Buscar usuario existente
      const existingUser = await strapi.query('plugin::users-permissions.user').findOne({
        where: { 
          email: profile.email.toLowerCase(),
          'providers.google': { $exists: true }
        }
      });

      if (existingUser) {
        // Usuario existe, login
        const jwt = strapi.plugin('users-permissions').service('jwt').issue({
          id: existingUser.id,
        });

        ctx.set('Authorization', `Bearer ${jwt}`);
        
        return ctx.send({
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            providers: existingUser.providers ? Object.keys(existingUser.providers) : []
          }
        });
      }

      // Buscar si el usuario existe con otros providers
      const users = await strapi.query('plugin::users-permissions.user').findMany({
        where: { email: profile.email.toLowerCase() }
      });

      if (users.length > 0) {
        // Usuario existe, agregar provider Google
        const user = users[0];
        
        const updatedUser = await strapi.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: {
            providers: {
              ...user.providers,
              google: {
                providerId: profile.id,
                connectedAt: new Date().toISOString(),
                profile: {
                  firstName: profile.given_name,
                  lastName: profile.family_name,
                  imageUrl: profile.picture
                }
              }
            },
            imageUrl: profile.picture || user.imageUrl,
            providerId: profile.id
          }
        });

        const jwt = strapi.plugin('users-permissions').service('jwt').issue({
          id: updatedUser.id,
        });

        ctx.set('Authorization', `Bearer ${jwt}`);
        
        return ctx.send({
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            providers: Object.keys(updatedUser.providers)
          }
        });
      }

      // Nuevo usuario, crear cuenta
      const userData = {
        email: profile.email,
        username: `${profile.email.split('@')[0]}_${Date.now()}`,
        firstName: profile.given_name,
        lastName: profile.family_name,
        providers: {
          google: {
            providerId: profile.id,
            connectedAt: new Date().toISOString(),
            profile: {
              firstName: profile.given_name,
              lastName: profile.family_name,
              imageUrl: profile.picture
            }
          }
        },
        imageUrl: profile.picture,
        confirmed: true,
        providerId: profile.id,
        role: 2 // Rol de usuario por defecto
      };

      const newUser = await strapi.query('plugin::users-permissions.user').create({
        data: userData
      });

      const jwt = strapi.plugin('users-permissions').service('jwt').issue({
        id: newUser.id,
      });

      ctx.set('Authorization', `Bearer ${jwt}`);
      
      return ctx.send({
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          providers: ['google']
        }
      });

    } catch (error) {
      console.error('Google OAuth error:', error);
      return ctx.badRequest(`OAuth error: ${error.message}`);
    }
  }
};
