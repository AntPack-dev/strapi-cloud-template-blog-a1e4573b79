'use strict';

/**
 * Multi-provider controller
 */

module.exports = {
  /**
   * Get user's connected providers
   */
  async getProviders(ctx) {
    const user = ctx.state.user;
    
    if (!user) {
      return ctx.unauthorized('User not authenticated');
    }

    try {
      const multiProviderService = strapi.plugin('users-permissions').service('multi-provider');
      const providers = multiProviderService.getUserProviders(user);
      
      return ctx.send({
        providers: providers,
        providersData: user.providers
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  /**
   * Remove a provider from user
   */
  async removeProvider(ctx) {
    const user = ctx.state.user;
    const { provider } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('User not authenticated');
    }

    try {
      const multiProviderService = strapi.plugin('users-permissions').service('multi-provider');
      
      // Cannot remove local provider if user has password
      if (provider === 'local' && user.password) {
        return ctx.badRequest('Cannot remove local authentication while password exists');
      }

      const updatedUser = await multiProviderService.removeProvider(user, provider);
      
      return ctx.send({
        message: `Provider ${provider} removed successfully`,
        user: updatedUser
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  /**
   * Update profile image from provider
   */
  async updateProfileImage(ctx) {
    const user = ctx.state.user;
    const { provider } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('User not authenticated');
    }

    if (!provider) {
      return ctx.badRequest('Provider is required');
    }

    try {
      const multiProviderService = strapi.plugin('users-permissions').service('multi-provider');
      
      const updatedUser = await multiProviderService.updateProfileImageFromProvider(user, provider);
      
      return ctx.send({
        message: `Profile image updated from ${provider}`,
        user: updatedUser
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  /**
   * Get complete user info with sensitive data (protected endpoint)
   */
  async getUserInfo(ctx) {
    const user = ctx.state.user;
    
    if (!user) {
      return ctx.unauthorized('User not authenticated');
    }

    try {
      // Get complete user data from database
      const completeUser = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: user.id },
        populate: ['role']
      });

      if (!completeUser) {
        return ctx.notFound('User not found');
      }

      return ctx.send({
        user: completeUser
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  }
};
