'use strict';

/**
 * Multi-provider authentication controller
 */

module.exports = {
  /**
   * Handle OAuth callback with multi-provider support
   */
  async callback(ctx) {
    const provider = ctx.params.provider;
    const { query } = ctx;

    if (!query.access_token) {
      return ctx.badRequest('Access token is required');
    }

    try {
      const multiProviderService = strapi.plugin('users-permissions').service('multi-provider');
      
      // Find user by provider
      const existingUser = await multiProviderService.findUserByEmailAndProvider(
        query.email, 
        provider
      );

      if (existingUser) {
        // User exists with this provider, login
        const jwt = strapi.plugin('users-permissions').service('jwt').issue({
          id: existingUser.id,
        });

        // Set JWT in header instead of body
        ctx.set('Authorization', `Bearer ${jwt}`);
        
        return ctx.send({
          user: this.transformUserResponse(existingUser)
        });
      }

      // Check if user exists with other providers
      const users = await strapi.query('plugin::users-permissions.user').findMany({
        where: { email: query.email.toLowerCase() }
      });

      if (users.length > 0) {
        // User exists but not with this provider, add this provider
        const user = users[0];
        
        // Get profile data from the OAuth service
        const profile = await this.getProfileData(provider, query.access_token);
        
        const updatedUser = await multiProviderService.addProvider(
          user, 
          provider, 
          profile.id, 
          profile
        );

        const jwt = strapi.plugin('users-permissions').service('jwt').issue({
          id: updatedUser.id,
        });

        // Set JWT in header instead of body
        ctx.set('Authorization', `Bearer ${jwt}`);

        return ctx.send({
          user: this.transformUserResponse(updatedUser)
        });
      }

      // New user, create with this provider
      const profile = await this.getProfileData(provider, query.access_token);
      
      const userData = {
        email: profile.email,
        username: this.generateUsername(profile.email),
        firstName: profile.given_name || profile.name?.givenName,
        lastName: profile.family_name || profile.name?.familyName,
        provider: provider,
        providers: {
          [provider]: {
            providerId: profile.id,
            connectedAt: new Date().toISOString(),
            profile: {
              firstName: profile.given_name || profile.name?.givenName,
              lastName: profile.family_name || profile.name?.familyName,
              imageUrl: profile.picture || profile.photos?.[0]?.value
            }
          }
        },
        imageUrl: profile.picture || profile.photos?.[0]?.value,
        confirmed: true,
        providerId: profile.id,
      };

      const user = await strapi.query('plugin::users-permissions.user').create({
        data: userData
      });

      // Transform response to hide sensitive data
      const transformedUser = this.transformUserResponse(user);

      const jwt = strapi.plugin('users-permissions').service('jwt').issue({
        id: user.id,
      });

      // Set JWT in header instead of body
      ctx.set('Authorization', `Bearer ${jwt}`);

      return ctx.send({
        user: transformedUser
      });

    } catch (error) {
      console.error('Multi-provider auth error:', error);
      return ctx.badRequest(error.message);
    }
  },

  /**
   * Get profile data from OAuth provider
   */
  async getProfileData(provider, accessToken) {
    if (provider === 'google') {
      const google = require('passport-google-oauth2');
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return await response.json();
    }

    if (provider === 'facebook') {
      const response = await fetch(`https://graph.facebook.com/me?fields=id,name,email,first_name,last_name,picture&access_token=${accessToken}`);
      const data = await response.json();
      return {
        id: data.id,
        email: data.email,
        given_name: data.first_name,
        family_name: data.last_name,
        picture: data.picture?.data?.url
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  },

  /**
   * Generate username from email
   */
  generateUsername(email) {
    const localPart = email.split('@')[0];
    const timestamp = Date.now();
    return `${localPart}_${timestamp}`;
  },

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
   * Transform user response to hide sensitive data
   */
  transformUserResponse(user) {
    const providersArray = [];
    
    if (user.providers) {
      if (user.providers.local) providersArray.push('local');
      if (user.providers.google) providersArray.push('google');
      if (user.providers.facebook) providersArray.push('facebook');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      providers: providersArray
    };
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
        user: completeUser // ← Respuesta completa con todos los datos
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  /**
   * Redirect to OAuth provider
   */
  async redirectToProvider(ctx) {
    const provider = ctx.params.provider || 'google';
    
    if (!['google', 'facebook'].includes(provider)) {
      return ctx.badRequest('Provider not supported');
    }

    try {
      // Get the OAuth URL from Strapi's auth service
      const authService = strapi.plugin('users-permissions').service('auth');
      const oauthUrl = await authService.getProviderRedirectUrl(provider);

      if (oauthUrl) {
        return ctx.redirect(oauthUrl);
      } else {
        // Fallback: construct the OAuth URL manually
        const baseUrl = provider === 'google' 
          ? 'https://accounts.google.com/o/oauth2/v2/auth'
          : 'https://www.facebook.com/v18.0/dialog/oauth';
        
        const params = new URLSearchParams();
        
        if (provider === 'google') {
          params.append('client_id', strapi.config.get('plugin.users-permissions.providers.google.clientID'));
          params.append('redirect_uri', `${ctx.request.origin}/api/users-permissions/multi-provider/callback/google`);
          params.append('response_type', 'code');
          params.append('scope', 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
          params.append('access_type', 'offline');
        } else {
          params.append('client_id', strapi.config.get('plugin.users-permissions.providers.facebook.clientID'));
          params.append('redirect_uri', `${ctx.request.origin}/api/users-permissions/multi-provider/callback/facebook`);
          params.append('response_type', 'code');
          params.append('scope', 'email');
        }
        
        const fullUrl = `${baseUrl}?${params.toString()}`;
        return ctx.redirect(fullUrl);
      }
    } catch (error) {
      console.error('Error redirecting to provider:', error);
      return ctx.badRequest(`Failed to redirect to ${provider}: ${error.message}`);
    }
  }
};
