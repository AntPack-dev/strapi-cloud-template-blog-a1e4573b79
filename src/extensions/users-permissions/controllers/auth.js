'use strict';

module.exports = {
  async callback(ctx) {
    const params = ctx.request.body;

    // Store the identifier to see if a user exists with this email
    const identifier = params.identifier;
    const password = params.password;

    if (!identifier || !password) {
      return ctx.badRequest('Missing identifier or password');
    }

    // Check if the user exists.
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: {
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
      populate: ['role'],
    });

    if (!user) {
      return ctx.unauthorized('Invalid credentials');
    }

    // Check if the user is active.
    if (!user.active) {
      return ctx.unauthorized('Your account has been disabled.');
    }

    // Check if the user is blocked.
    if (user.blocked) {
      return ctx.unauthorized('Your account has been blocked.');
    }

    // Check if the provided password is correct.
    const validPassword = await strapi.plugin('users-permissions').service('user').validatePassword(password, user.password);

    if (!validPassword) {
      return ctx.unauthorized('Invalid credentials');
    }

    // Generate JWT
    const jwt = strapi.plugin('users-permissions').service('jwt').issue({
      id: user.id,
    });

    // Transform user response to match our format
    const providersArray = [];
    
    if (user.providers) {
      if (user.providers.local) providersArray.push('local');
      if (user.providers.google) providersArray.push('google');
      if (user.providers.facebook) providersArray.push('facebook');
    }

    const transformedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      providers: providersArray
    };

    // Set JWT in header
    ctx.set('Authorization', `Bearer ${jwt}`);

    return ctx.send({
      user: transformedUser
    });
  },

  async register(ctx) {
    const params = ctx.request.body;

    // Basic validation
    if (!params.email || !params.password || !params.username) {
      return ctx.badRequest('Missing required fields');
    }

    // Check if user already exists
    const userExists = await strapi.query('plugin::users-permissions.user').findOne({
      where: {
        $or: [
          { email: params.email.toLowerCase() },
          { username: params.username },
        ],
      },
    });

    if (userExists) {
      return ctx.badRequest('User already exists');
    }

    // Get default role
    const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: {
        type: 'authenticated',
      },
    });

    if (!defaultRole) {
      return ctx.badRequest('Default role not found');
    }

    // Create user data
    const userData = {
      ...params,
      email: params.email.toLowerCase(),
      role: defaultRole.id,
      provider: 'local',
      providers: {
        local: true
      },
      confirmed: true,
      localIntegration: true,
    };

    // Create user
    const user = await strapi.query('plugin::users-permissions.user').create({
      data: userData,
    });

    // Create default favorite list for new user
    try {
      const favoriteListService = strapi.service('api::favorite-list.favorite-list-service');
      await favoriteListService.createDefaultFavoriteList(user.id);
    } catch (error) {
      strapi.log.error('Error creating default favorite list for new user:', error);
      // Don't fail registration if favorite list creation fails
    }

    // If notificationActive is true, add user to Mailchimp
    if (params.notificationActive === true) {
      try {
        const campaignId = process.env.MAILCHIMP_CAMPAIGN_ID;
        if (campaignId) {
          const marketingService = strapi.service('api::marketing.marketing');
          const listId = await marketingService.getListIdFromCampaign(campaignId);
          await marketingService.createContact(user.email, listId);
          strapi.log.info(`User ${user.email} added to Mailchimp list`);
        }
      } catch (error) {
        strapi.log.error('Error adding user to Mailchimp:', error);
        // Don't fail registration if Mailchimp fails
      }
    }

    // Generate JWT
    const jwt = strapi.plugin('users-permissions').service('jwt').issue({
      id: user.id,
    });

    // Transform user response
    const transformedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      providers: ['local']
    };

    // Set JWT in header
    ctx.set('Authorization', `Bearer ${jwt}`);

    return ctx.send({
      user: transformedUser
    });
  }
};
