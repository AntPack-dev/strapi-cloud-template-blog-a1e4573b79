'use strict';

module.exports = {
  async forgot(ctx) {
    const { email, lang } = ctx.request.body;

    if (!email) {
      return ctx.badRequest('Email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ctx.badRequest('Invalid email format');
    }

    try {
      const passwordService = strapi.service('api::password.password');
      await passwordService.sendResetPasswordEmail({ email, lang });

      return ctx.send({ ok: true });
    } catch (error) {
      strapi.log.error('[PasswordController] Error:', error);
      return ctx.internalServerError('Error sending reset password email');
    }
  },

  async reset(ctx) {
    const { token, password, confirmPassword } = ctx.request.body;

    if (!token || !password || !confirmPassword) {
      return ctx.badRequest('Token, password and confirmPassword are required');
    }

    if (password !== confirmPassword) {
      return ctx.badRequest('Passwords do not match');
    }

    // Validate password strength
    if (password.length < 8) {
      return ctx.badRequest('Password must be at least 8 characters long');
    }

    try {
      const passwordService = strapi.service('api::password.password');
      const result = await passwordService.resetPassword({ token, password });

      return ctx.send(result);
    } catch (error) {
      strapi.log.error('[PasswordController] Reset error:', error);
      return ctx.badRequest(error.message);
    }
  },
};
