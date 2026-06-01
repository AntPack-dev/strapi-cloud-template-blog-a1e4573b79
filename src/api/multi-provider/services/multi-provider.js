'use strict';

/**
 * Multi-provider service
 */

module.exports = {
  /**
   * Get user's connected providers
   */
  async getProviders(user) {
    if (!user || !user.providers) {
      return [];
    }
    return Object.keys(user.providers);
  },

  /**
   * Remove a provider from a user (but keep at least one provider)
   */
  async removeProvider(user, providerToRemove) {
    if (!user || !user.providers) {
      throw new Error('User has no providers');
    }

    const currentProviders = user.providers;
    const providerKeys = Object.keys(currentProviders);
    
    // Cannot remove if it's the only provider
    if (providerKeys.length === 1) {
      throw new Error('Cannot remove the only authentication method');
    }

    // Special validation: cannot remove local if user has password
    if (providerToRemove === 'local' && user.password) {
      throw new Error('Cannot remove local authentication while password exists');
    }

    // Cannot remove the provider if it would leave only OAuth providers without local
    // and user doesn't have a password (to prevent being locked out)
    if (providerToRemove !== 'local' && currentProviders.local && !user.password) {
      const remainingProviders = providerKeys.filter(p => p !== providerToRemove);
      const hasLocalRemaining = remainingProviders.includes('local');
      
      if (!hasLocalRemaining && remainingProviders.every(p => ['google', 'facebook'].includes(p))) {
        throw new Error('Cannot remove all OAuth providers when local authentication has no password');
      }
    }

    // Check if provider exists
    if (!currentProviders[providerToRemove]) {
      throw new Error(`Provider ${providerToRemove} not found for this user`);
    }

    // Remove the provider
    const { [providerToRemove]: removed, ...remainingProviders } = currentProviders;

    // Update the user
    const updatedUser = await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        providers: remainingProviders,
        // Update main provider field to the first remaining provider
        provider: Object.keys(remainingProviders)[0]
      }
    });

    return updatedUser;
  },

  /**
   * Update user profile image from provider
   */
  async updateProfileImageFromProvider(user, provider) {
    if (!user || !user.providers || !user.providers[provider]) {
      throw new Error(`Provider ${provider} not found for user`);
    }

    const providerData = user.providers[provider];
    const providerImageUrl = providerData.profile?.imageUrl;

    if (!providerImageUrl) {
      throw new Error(`No image found for provider ${provider}`);
    }

    const updatedUser = await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        imageUrl: providerImageUrl
      }
    });

    return updatedUser;
  }
};
