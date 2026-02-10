'use strict';

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Solo procesar rutas de autenticación
    if (ctx.request.url === '/api/auth/local' || ctx.request.url === '/api/auth/local/register') {
      await next();
      
      // Transformar la respuesta si es exitosa
      if (ctx.status === 200 && ctx.body && ctx.body.user) {
        const user = ctx.body.user;
        const jwt = ctx.body.jwt;
        
        // Extraer providers array
        const providersArray = [];
        if (user.providers) {
          if (user.providers.local) providersArray.push('local');
          if (user.providers.google) providersArray.push('google');
          if (user.providers.facebook) providersArray.push('facebook');
        }
        
        // Crear respuesta transformada
        const transformedUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          providers: providersArray
        };
        
        // Mover JWT al header
        if (jwt) {
          ctx.set('Authorization', `Bearer ${jwt}`);
        }
        
        // Reemplazar body
        ctx.body = {
          user: transformedUser
        };
      }
    } else {
      await next();
    }
  };
};
