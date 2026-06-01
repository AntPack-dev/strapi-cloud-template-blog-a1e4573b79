'use strict';

/**
 * user notification controller
 */

module.exports = ({ strapi }) => ({
  /**
   * Toggle notificationActive for authenticated user
   */
  async toggle(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('Usuario no autenticado');
      }

      // Get user notification service
      const userNotificationService = strapi.service('api::user.user-notification');

      // Toggle notification status
      const result = await userNotificationService.toggleNotificationActive(userId);

      return ctx.send(result);
    } catch (error) {
      strapi.log.error('[UserNotification] Error en toggle:', error);

      return ctx.internalServerError({
        message: 'Error al actualizar estado de notificaciones',
        error: error.message,
      });
    }
  },

  /**
   * Get notification status for authenticated user
   */
  async status(ctx) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized('Usuario no autenticado');
      }

      // Get user notification service
      const userNotificationService = strapi.service('api::user.user-notification');

      // Get notification status
      const result = await userNotificationService.getNotificationStatus(userId);

      return ctx.send(result);
    } catch (error) {
      strapi.log.error('[UserNotification] Error en status:', error);

      return ctx.internalServerError({
        message: 'Error al obtener estado de notificaciones',
        error: error.message,
      });
    }
  },

  /**
   * Toggle notificationActive for admin (any user)
   */
  async adminToggle(ctx) {
    try {
      const { userId } = ctx.params;

      if (!userId) {
        return ctx.badRequest('Se requiere el ID del usuario');
      }

      // Check if user has admin permissions
      const isAdmin = ctx.state.user?.role?.name === 'Administrator' || 
                     ctx.state.user?.role?.type === 'admin';

      if (!isAdmin) {
        return ctx.forbidden('Se requieren permisos de administrador');
      }

      // Get user notification service
      const userNotificationService = strapi.service('api::user.user-notification');

      // Toggle notification status
      const result = await userNotificationService.toggleNotificationActive(parseInt(userId));

      return ctx.send(result);
    } catch (error) {
      strapi.log.error('[UserNotification] Error en adminToggle:', error);

      return ctx.internalServerError({
        message: 'Error al actualizar estado de notificaciones',
        error: error.message,
      });
    }
  },

  /**
   * Get notification status for admin (any user)
   */
  async adminStatus(ctx) {
    try {
      const { userId } = ctx.params;

      if (!userId) {
        return ctx.badRequest('Se requiere el ID del usuario');
      }

      // Check if user has admin permissions
      const isAdmin = ctx.state.user?.role?.name === 'Administrator' || 
                     ctx.state.user?.role?.type === 'admin';

      if (!isAdmin) {
        return ctx.forbidden('Se requieren permisos de administrador');
      }

      // Get user notification service
      const userNotificationService = strapi.service('api::user.user-notification');

      // Get notification status
      const result = await userNotificationService.getNotificationStatus(parseInt(userId));

      return ctx.send(result);
    } catch (error) {
      strapi.log.error('[UserNotification] Error en adminStatus:', error);

      return ctx.internalServerError({
        message: 'Error al obtener estado de notificaciones',
        error: error.message,
      });
    }
  },
});
