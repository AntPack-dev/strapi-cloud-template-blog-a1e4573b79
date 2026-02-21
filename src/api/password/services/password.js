'use strict';

const crypto = require('crypto');

module.exports = () => ({
  async sendResetPasswordEmail({ email, lang = 'en' }) {
    console.log('[PasswordService] Iniciando reset password para:', email, 'idioma:', lang);

    // Validate lang
    const validLangs = ['en', 'es'];
    const language = validLangs.includes(lang) ? lang : 'en';

    // Find user
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log('[PasswordService] Usuario no encontrado:', email);
      // Don't reveal if user exists
      return { ok: true };
    }

    // Generate reset token (same way Strapi does it)
    const resetPasswordToken = crypto.randomBytes(64).toString('hex');

    // Update user with token and expiration (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { 
        resetPasswordToken,
        resetPasswordExpires: expiresAt
      },
    });

    console.log('[PasswordService] Token generado:', resetPasswordToken.substring(0, 20) + '...');

    // Get redirect URL from env
    const redirectUrl = process.env.REDIRECT_URL_FORGOT_PASSWORD || 'http://localhost:3000/reset-password';
    
    // Build reset URL
    const resetUrl = `${redirectUrl}${language}/reset-password?token=${resetPasswordToken}`;

    console.log('[PasswordService] URL de reset:', resetUrl);

    // Email templates
    const templates = {
      en: {
        subject: 'Reset your password',
        html: `
          <h2>Reset your password</h2>
          <p>We noticed that you need to reset your password for your account.</p>
          <p>Please click on the following link to reset your password. This link is valid for only 5 minutes.</p>
          
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Reset Password</a>
          
          <p>If you didn't request this, please ignore this email.</p>
          
          <p>Best regards,<br>Soporte Latilde</p>
        `,
        text: `Reset your password

We noticed that you need to reset your password for your account.

Please click on the following link to reset your password. This link is valid for only 5 minutes.

${resetUrl}

If you didn't request this, please ignore this email.

Best regards,
Soporte Latilde`,
      },
      es: {
        subject: 'Restablece tu contraseña',
        html: `
          <h2>Restablece tu contraseña</h2>
          <p>Hemos notado que necesitas restablecer tu contraseña.</p>
          <p>Por favor haz clic en el siguiente enlace para restablecer tu contraseña. Este enlace es válido solo por 5 minutos.</p>
          
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Restablecer Contraseña</a>
          
          <p>Si no solicitaste esto, por favor ignora este correo.</p>
          
          <p>Saludos,<br>Soporte Latilde</p>
        `,
        text: `Restablece tu contraseña

Hemos notado que necesitas restablecer tu contraseña.

Por favor haz clic en el siguiente enlace para restablecer tu contraseña. Este enlace es válido solo por 5 minutos.

${resetUrl}

Si no solicitaste esto, por favor ignora este correo.

Saludos,
Soporte Latilde`,
      },
    };

    const template = templates[language];

    try {
      // Send email
      await strapi.plugin('email').service('email').send({
        to: user.email,
        from: process.env.RESEND_EMAIL_SENDER || 'info@latilde.co',
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log('[PasswordService] ✅ Email enviado exitosamente a', user.email, 'en', language);
      
      return { ok: true };
    } catch (error) {
      console.error('[PasswordService] ❌ Error enviando email:', error);
      throw error;
    }
  },

  async resetPassword({ token, password }) {
    console.log('[PasswordService] Iniciando reset password con token:', token.substring(0, 20) + '...');

    // Find user by reset token
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { resetPasswordToken: token },
    });

    if (!user) {
      console.log('[PasswordService] Token no encontrado o inválido');
      throw new Error('Invalid or expired reset token');
    }

    console.log('[PasswordService] Usuario encontrado:', user.email);

    // Check if token has expired (5 minutes)
    if (user.resetPasswordExpires && new Date() > new Date(user.resetPasswordExpires)) {
      console.log('[PasswordService] Token expirado para:', user.email);
      
      // Clear expired token
      await strapi.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { 
          resetPasswordToken: null,
          resetPasswordExpires: null
        },
      });
      
      throw new Error('Reset token has expired');
    }

    console.log('[PasswordService] Token válido, actualizando contraseña');

    // Hash the new password using bcrypt directly
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with new password and clear reset token (single use)
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null, // Clear the token (single use)
        resetPasswordExpires: null, // Clear expiration
      },
    });

    console.log('[PasswordService] ✅ Contraseña actualizada exitosamente para:', user.email);

    return {
      ok: true,
      message: 'Password reset successfully',
    };
  },
});
