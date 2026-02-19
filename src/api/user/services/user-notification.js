'use strict';

/**
 * User notification service
 */

module.exports = ({ strapi }) => ({
  /**
   * Toggle notificationActive for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Updated user with notification status
   */
  async toggleNotificationActive(userId) {
    try {
      // Get current user
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Toggle notificationActive
      const newNotificationActive = !user.notificationActive;
      
      // Update user
      const updatedUser = await strapi.query('plugin::users-permissions.user').update({
        where: { id: userId },
        data: { notificationActive: newNotificationActive },
      });

      // Get marketing service
      const marketingService = strapi.service('api::marketing.marketing');

      if (newNotificationActive) {
        // User wants to be active - add to marketing
        try {
          await marketingService.submitContactForm({
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            phone: '', // User might not have phone in profile
            description: 'Usuario activado para notificaciones',
          });
          
          strapi.log.info(`[UserNotification] Usuario ${userId} activado para notificaciones y agregado a Mailchimp`);
        } catch (marketingError) {
          strapi.log.error('[UserNotification] Error al agregar usuario a Mailchimp:', marketingError);
          // Don't fail the toggle if marketing fails
        }
      } else {
        // User wants to be inactive - remove from marketing
        try {
          await marketingService.removeContact(user.email);
          strapi.log.info(`[UserNotification] Usuario ${userId} desactivado para notificaciones y eliminado de Mailchimp`);
        } catch (marketingError) {
          strapi.log.error('[UserNotification] Error al eliminar usuario de Mailchimp:', marketingError);
          // Don't fail the toggle if marketing fails
        }
      }

      return {
        success: true,
        message: newNotificationActive 
          ? 'Notificaciones activadas exitosamente' 
          : 'Notificaciones desactivadas exitosamente',
        data: {
          userId: updatedUser.id,
          notificationActive: updatedUser.notificationActive,
          email: updatedUser.email,
        },
      };
    } catch (error) {
      strapi.log.error('[UserNotification] Error al toggle notificationActive:', error);
      throw new Error(`Error al actualizar estado de notificaciones: ${error.message}`);
    }
  },

  /**
   * Get notification status for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - User notification status
   */
  async getNotificationStatus(userId) {
    try {
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        select: ['id', 'email', 'notificationActive', 'firstName', 'lastName'],
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      return {
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          notificationActive: user.notificationActive,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    } catch (error) {
      strapi.log.error('[UserNotification] Error al obtener estado de notificaciones:', error);
      throw new Error(`Error al obtener estado de notificaciones: ${error.message}`);
    }
  },
});
