'use strict';

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Solo procesar callbacks de OAuth
    if (ctx.path.includes('/connect/google/callback') || ctx.path.includes('/connect/facebook/callback')) {
      const { access_token, code } = ctx.query;
      
      // Detectar el provider desde la URL
      const provider = ctx.path.includes('/connect/google/') ? 'google' : 'facebook';

      // Si hay access_token, procesarlo directamente
      if (access_token) {
        try {
          let profile;
          
          // Obtener perfil según el provider
          if (provider === 'google') {
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: {
                'Authorization': `Bearer ${access_token}`
              }
            });

            if (!profileResponse.ok) {
              const errorText = await profileResponse.text();
              throw new Error(`Failed to get user profile from Google: ${profileResponse.status} - ${errorText}`);
            }

            profile = await profileResponse.json();
          } else if (provider === 'facebook') {
            const profileResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email,first_name,last_name,picture&access_token=${access_token}`);

            if (!profileResponse.ok) {
              const errorText = await profileResponse.text();
              throw new Error(`Failed to get user profile from Facebook: ${profileResponse.status} - ${errorText}`);
            }

            const data = await profileResponse.json();
            profile = {
              id: data.id,
              email: data.email,
              given_name: data.first_name,
              family_name: data.last_name,
              picture: data.picture?.data?.url
            };
          }
          
          if (!profile.email) {
            return ctx.badRequest(`Unable to get email from ${provider} profile`);
          }

          const emailToSearch = profile.email.toLowerCase();

          // Buscar usuario por email
          let users = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: {
              email: {
                $eqi: emailToSearch
              }
            }
          });

          if (users && users.length > 0) {
            // Usuario existe - hacer login o agregar provider
            const user = users[0];
            
            // Reactivar cuenta si está desactivada
            if (user.statusProfile === 'deactivated') {
              await strapi.query('plugin::users-permissions.user').update({
                where: { id: user.id },
                data: { statusProfile: 'active' }
              });
              user.statusProfile = 'active';
            }
            
            // Verificar si ya tiene este provider
            const hasProvider = user.providers && user.providers[provider];
            
            if (!hasProvider) {
              // Agregar el nuevo provider al usuario existente
              
              // Asegurar que el usuario tenga un rol
              if (!user.role) {
                const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
                  where: { type: 'authenticated' }
                });
                
                if (defaultRole) {
                  await strapi.query('plugin::users-permissions.user').update({
                    where: { id: user.id },
                    data: { role: defaultRole.id }
                  });
                  user.role = defaultRole;
                }
              }
              
              // Prepare update data with provider and image
              const updateData = {
                providers: {
                  ...user.providers,
                  [provider]: true
                }
              };
              
              // Update imageUrl if user doesn't have one and profile has a picture
              if (!user.imageUrl && profile.picture) {
                updateData.imageUrl = profile.picture;
              }
              
              const updatedUser = await strapi.query('plugin::users-permissions.user').update({
                where: { id: user.id },
                data: updateData
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
            } else {
              // Usuario ya tiene este provider - solo hacer login
              
              // Asegurar que el usuario tenga un rol
              if (!user.role) {
                const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
                  where: { type: 'authenticated' }
                });
                
                if (defaultRole) {
                  await strapi.query('plugin::users-permissions.user').update({
                    where: { id: user.id },
                    data: { role: defaultRole.id }
                  });
                  user.role = defaultRole;
                }
              }
              
              // Update imageUrl if user doesn't have one and profile has a picture
              if (!user.imageUrl && profile.picture) {
                await strapi.query('plugin::users-permissions.user').update({
                  where: { id: user.id },
                  data: { imageUrl: profile.picture }
                });
                user.imageUrl = profile.picture;
              }
              
              const jwt = strapi.plugin('users-permissions').service('jwt').issue({
                id: user.id,
              });

              ctx.set('Authorization', `Bearer ${jwt}`);
              
              return ctx.send({
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  providers: user.providers ? Object.keys(user.providers) : []
                }
              });
            }
          }

          // Nuevo usuario, crear cuenta
          const emailPrefix = profile.email.split('@')[0].substring(0, 20);
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const username = `${emailPrefix}_${randomSuffix}`;
          
          // Obtener el rol por defecto
          const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
            where: { type: 'authenticated' }
          });
          
          // Truncar campos a 255 caracteres para evitar errores
          const truncate = (str, maxLength = 255) => {
            if (!str) return '';
            return str.substring(0, maxLength);
          };
          
          const userData = {
            email: truncate(profile.email, 255),
            username: truncate(username, 255),
            firstName: truncate(profile.given_name || 'User', 50),
            lastName: truncate(profile.family_name || '', 50),
            providers: {
              [provider]: true
            },
            imageUrl: truncate(profile.picture || '', 255),
            confirmed: true,
            localIntegration: false,
            role: defaultRole ? defaultRole.id : null
          };

          const newUser = await strapi.query('plugin::users-permissions.user').create({
            data: userData
          });

          // Create default favorite list for new OAuth user
          try {
            const favoriteListService = strapi.service('api::favorite-list.favorite-list-service');
            await favoriteListService.createDefaultFavoriteList(newUser.id);
          } catch (error) {
            strapi.log.error('Error creating default favorite list for OAuth user:', error);
            // Don't fail registration if favorite list creation fails
          }

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
              providers: [provider]
            }
          });

        } catch (error) {
          console.error('❌ OAuth callback error:', error);
          console.error('❌ Error stack:', error.stack);
          return ctx.badRequest(`OAuth error: ${error.message}`);
        }
      }
    }

    // Si no es access_token o no es callback, continuar con el flujo normal
    await next();
  };
};
