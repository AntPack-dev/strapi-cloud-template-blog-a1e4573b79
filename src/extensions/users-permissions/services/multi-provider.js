'use strict';

/**
 * Multi-provider service for handling multiple authentication providers
 */

module.exports = {
  /**
   * Add a new provider to an existing user
   * @param {Object} user - The user object
   * @param {string} newProvider - The new provider to add ('google' or 'facebook')
   * @param {string} providerId - The provider ID from the OAuth service
   * @param {Object} profile - The profile data from OAuth
   * @returns {Object} Updated user object
   */
  async addProvider(user, newProvider, providerId, profile) {
    if (!user || !newProvider || !providerId) {
      throw new Error('Missing required parameters');
    }

    // Get current providers or initialize if doesn't exist
    const currentProviders = user.providers || { local: true };
    
    // Check if provider already exists
    if (currentProviders[newProvider]) {
      throw new Error(`Provider ${newProvider} already exists for this user`);
    }

    // Add the new provider
    const updatedProviders = {
      ...currentProviders,
      [newProvider]: {
        providerId: providerId,
        connectedAt: new Date().toISOString(),
        profile: {
          firstName: profile.given_name || profile.name?.givenName,
          lastName: profile.family_name || profile.name?.familyName,
          imageUrl: profile.picture || profile.photos?.[0]?.value
        }
      }
    };

    // Update the user
    const providerImageUrl = profile.picture || profile.photos?.[0]?.value;
    const updatedUser = await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        providers: updatedProviders,
        // Update imageUrl logic:
        // 1. If user has no imageUrl, use provider image
        // 2. If user has imageUrl but it's from a provider, update with new provider image
        // 3. If user has custom imageUrl, keep it
        imageUrl: !user.imageUrl || 
                 (user.imageUrl && (user.imageUrl.includes('googleusercontent.com') || 
                                   user.imageUrl.includes('graph.facebook.com'))) 
                 ? providerImageUrl 
                 : user.imageUrl
      }
    });

    return updatedUser;
  },

  /**
   * Check if a user has a specific provider
   * @param {Object} user - The user object
   * @param {string} provider - The provider to check
   * @returns {boolean} Whether the user has the provider
   */
  hasProvider(user, provider) {
    if (!user || !user.providers) {
      return false;
    }
    return !!user.providers[provider];
  },

  /**
   * Get all providers for a user
   * @param {Object} user - The user object
   * @returns {Array} Array of provider names
   */
  getUserProviders(user) {
    if (!user || !user.providers) {
      return [];
    }
    return Object.keys(user.providers);
  },

  /**
   * Find user by email and provider
   * @param {string} email - The user's email
   * @param {string} provider - The provider to search for
   * @returns {Object|null} User object or null
   */
  async findUserByEmailAndProvider(email, provider) {
    const users = await strapi.query('plugin::users-permissions.user').findMany({
      where: { email: email.toLowerCase() }
    });

    for (const user of users) {
      if (this.hasProvider(user, provider)) {
        return user;
      }
    }

    return null;
  },

  /**
   * Remove a provider from a user (but keep at least one provider)
   * @param {Object} user - The user object
   * @param {string} providerToRemove - The provider to remove
   * @returns {Object} Updated user object
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
   * @param {Object} user - The user object
   * @param {string} provider - The provider to get image from
   * @returns {Object} Updated user object
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
  },

  /**
   * Sync provider field with providers object
   * @param {Object} user - The user object
   * @returns {Object} Updated user object
   */
  async syncProviderField(user) {
    if (!user || !user.providers) {
      return user;
    }

    const providerKeys = Object.keys(user.providers);
    const mainProvider = providerKeys[0]; // Use the first provider as main

    if (user.provider !== mainProvider) {
      const updatedUser = await strapi.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { provider: mainProvider }
      });
      return updatedUser;
    }

    return user;
  }
};
