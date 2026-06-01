module.exports = {
  'reset-password': {
    from: {
      name: 'Soporte Latilde',
      email: 'info@latilde.co',
    },
    subject: 'Reset your password',
    text: `We noticed that you need to reset your password for your Strapi account.
    
Please click on the following link to reset your password. This link is valid for only 24 hours.

{{url}}

If you didn't request this, please ignore this email.`,
    html: `
      <h2>Reset your password</h2>
      <p>We noticed that you need to reset your password for your Strapi account.</p>
      <p>Please click on the following link to reset your password. This link is valid for only 24 hours.</p>
      
      <a href="{{url}}" style="background-color: #4CAF50; color: white; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Reset Password</a>
      
      <p>If you didn't request this, please ignore this email.</p>
      
      <p>Best regards,<br>Soporte Latilde</p>
    `,
  },
};
