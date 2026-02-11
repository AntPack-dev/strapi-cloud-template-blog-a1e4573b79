'use strict';

module.exports = {
  async getRoutes(ctx) {
    try {
      // Obtener todas las rutas registradas
      const routes = strapi.server.router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
          stack: layer.route.stack.map(handler => handler.name || 'anonymous')
        }));

      // Filtrar rutas de OAuth
      const oauthRoutes = routes.filter(route => 
        route.path.includes('google') || 
        route.path.includes('facebook') || 
        route.path.includes('connect') ||
        route.path.includes('multi-provider')
      );

      return ctx.send({
        totalRoutes: routes.length,
        oauthRoutes,
        allRoutes: routes.slice(0, 20) // Primeras 20 rutas para no sobrecargar
      });
    } catch (error) {
      return ctx.badRequest(`Error getting routes: ${error.message}`);
    }
  }
};
