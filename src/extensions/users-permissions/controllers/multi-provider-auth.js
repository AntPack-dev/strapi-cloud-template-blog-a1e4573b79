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
      
      // Get profile data from the OAuth service first
      const profile = await this.getProfileData(provider, query.access_token);
      
      if (!profile || !profile.email) {
        return ctx.badRequest('Unable to get user profile from OAuth provider');
      }
      
      // Find user by provider
      const existingUser = await multiProviderService.findUserByEmailAndProvider(
        profile.email, 
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
        where: { email: profile.email.toLowerCase() }
      });

      if (users.length > 0) {
        // User exists but not with this provider, add this provider
        const user = users[0];
        
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
      // Profile data already obtained above
      
      // Check if notificationActive is passed in query
      const notificationActive = query.notificationActive === 'true' || query.notificationActive === true;

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
        localIntegration: false,
        notificationActive: notificationActive,
      };

      const user = await strapi.query('plugin::users-permissions.user').create({
        data: userData
      });

      // If notificationActive is true, add user to Mailchimp
      if (notificationActive) {
        try {
          const campaignId = process.env.MAILCHIMP_CAMPAIGN_ID;
          if (campaignId) {
            const marketingService = strapi.service('api::marketing.marketing');
            const listId = await marketingService.getListIdFromCampaign(campaignId);
            await marketingService.createContact(user.email, listId);
            strapi.log.info(`User ${user.email} added to Mailchimp list via OAuth`);
          }
        } catch (error) {
          strapi.log.error('Error adding OAuth user to Mailchimp:', error);
          // Don't fail registration if Mailchimp fails
        }
      }

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
      // Debug: Verificar variables de entorno
      console.log('Environment variables check:');
      console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
      console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
      console.log('FACEBOOK_APP_ID:', process.env.FACEBOOK_APP_ID ? 'SET' : 'NOT SET');
      console.log('FACEBOOK_APP_SECRET:', process.env.FACEBOOK_APP_SECRET ? 'SET' : 'NOT SET');

      const baseUrl = provider === 'google' 
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://www.facebook.com/v18.0/dialog/oauth';
      
      const params = new URLSearchParams();
      
      if (provider === 'google') {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
          return ctx.badRequest('Google OAuth not configured: Missing GOOGLE_CLIENT_ID');
        }
        
        params.append('client_id', clientId);
        params.append('redirect_uri', `http://localhost:4060/en/auth/google/callback`);
        params.append('response_type', 'code');
        params.append('scope', 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
        params.append('access_type', 'offline');
        params.append('prompt', 'consent');
      } else {
        const appId = process.env.FACEBOOK_APP_ID;
        if (!appId) {
          return ctx.badRequest('Facebook OAuth not configured: Missing FACEBOOK_APP_ID');
        }
        
        params.append('client_id', appId);
        params.append('redirect_uri', `http://localhost:4060/en/auth/facebook/callback`);
        params.append('response_type', 'code');
        params.append('scope', 'email');
      }
      
      const fullUrl = `${baseUrl}?${params.toString()}`;
      console.log('Redirecting to:', fullUrl);
      
      return ctx.redirect(fullUrl);
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  /**
   * Debug OAuth configuration
   */
  async debugOAuthConfig(ctx) {
    try {
      const config = {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
          clientIdValue: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...' || null,
        },
        facebook: {
          appId: process.env.FACEBOOK_APP_ID ? 'SET' : 'NOT SET',
          appSecret: process.env.FACEBOOK_APP_SECRET ? 'SET' : 'NOT SET',
          appIdValue: process.env.FACEBOOK_APP_ID?.substring(0, 10) + '...' || null,
        },
        server: {
          origin: ctx.request.origin,
          nodeEnv: process.env.NODE_ENV,
        },
        plugins: {
          authConfigured: !!strapi.config.get('plugin.users-permissions.auth'),
          providersCount: strapi.config.get('plugin.users-permissions.auth.providers')?.length || 0,
        }
      };

      return ctx.send({
        message: 'OAuth configuration debug',
        config
      });
    } catch (error) {
      return ctx.badRequest(`Debug error: ${error.message}`);
    }
  }
};
