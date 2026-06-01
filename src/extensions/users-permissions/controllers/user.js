'use strict';

/**
 * User controller override to handle OAuth user updates
 */

module.exports = {
  /**
   * Update a user - custom implementation to handle OAuth users
   */
  async update(ctx) {
    const { id } = ctx.params;
    const { body } = ctx.request;
    const authenticatedUser = ctx.state.user;

    // Verificar que el usuario está autenticado
    if (!authenticatedUser) {
      return ctx.unauthorized('You must be logged in to update your profile');
    }

    // Verificar que el usuario solo puede actualizar su propio perfil
    if (authenticatedUser.id.toString() !== id.toString()) {
      return ctx.forbidden('You can only update your own profile');
    }

    try {
      // Campos permitidos para actualizar
      const allowedFields = [
        'firstName',
        'lastName',
        'biography',
        'imageUrl',
        'statusProfile',
        'notificationActive'
      ];

      // Filtrar solo los campos permitidos
      const updateData = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      // Si no hay campos para actualizar
      if (Object.keys(updateData).length === 0) {
        return ctx.badRequest('No valid fields to update');
      }

      // Actualizar el usuario
      const updatedUser = await strapi.query('plugin::users-permissions.user').update({
        where: { id: parseInt(id) },
        data: updateData,
        populate: ['role']
      });

      if (!updatedUser) {
        return ctx.notFound('User not found');
      }

      // Sanitizar la respuesta (no devolver password, etc.)
      const sanitizedUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        biography: updatedUser.biography,
        imageUrl: updatedUser.imageUrl,
        statusProfile: updatedUser.statusProfile,
        notificationActive: updatedUser.notificationActive,
        provider: updatedUser.provider,
        providers: updatedUser.providers ? Object.keys(updatedUser.providers) : [],
        confirmed: updatedUser.confirmed,
        blocked: updatedUser.blocked,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      };

      return ctx.send({
        user: sanitizedUser,
        message: 'Profile updated successfully'
      });

    } catch (error) {
      console.error('Error updating user:', error);
      return ctx.badRequest('Error updating profile: ' + error.message);
    }
  },

  /**
   * Deactivate user account - changes statusProfile to 'deactivated'
   */
  async deactivateAccount(ctx) {
    const authenticatedUser = ctx.state.user;

    // Verificar que el usuario está autenticado
    if (!authenticatedUser) {
      return ctx.unauthorized('You must be logged in to deactivate your account');
    }

    try {
      // Cambiar status a 'deactivated'
      const updatedUser = await strapi.query('plugin::users-permissions.user').update({
        where: { id: authenticatedUser.id },
        data: { statusProfile: 'deactivated' },
        populate: ['role']
      });

      if (!updatedUser) {
        return ctx.notFound('User not found');
      }

      // Sanitizar la respuesta
      const sanitizedUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        statusProfile: updatedUser.statusProfile,
        provider: updatedUser.provider,
        providers: updatedUser.providers ? Object.keys(updatedUser.providers) : [],
        confirmed: updatedUser.confirmed,
        blocked: updatedUser.blocked,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      };

      return ctx.send({
        user: sanitizedUser,
        message: 'Account deactivated successfully. Your content will no longer be visible, but your data is preserved. You can reactivate your account by logging back in.'
      });

    } catch (error) {
      console.error('Error deactivating account:', error);
      return ctx.badRequest('Error deactivating account: ' + error.message);
    }
  }
};
