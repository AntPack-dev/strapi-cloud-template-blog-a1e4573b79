'use strict';

module.exports = {
  async removeProvider(ctx) {
    const user = ctx.state.user;
    const { provider } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('User not authenticated');
    }

    if (!provider) {
      return ctx.badRequest('Provider is required');
    }

    try {
      // Get current providers
      const currentProviders = user.providers || {};
      const providerKeys = Object.keys(currentProviders);
      
      // Cannot remove if it's the only provider
      if (providerKeys.length === 1) {
        return ctx.badRequest('Cannot remove the only authentication method');
      }

      // Check if provider exists
      if (!currentProviders[provider]) {
        return ctx.badRequest(`Provider ${provider} not found for this user`);
      }

      // Remove the provider
      const { [provider]: removed, ...remainingProviders } = currentProviders;

      // Update the user
      const updatedUser = await strapi.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          providers: remainingProviders,
          provider: Object.keys(remainingProviders)[0]
        }
      });

      return ctx.send({
        message: `Provider ${provider} removed successfully`,
        user: updatedUser
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  }
};
