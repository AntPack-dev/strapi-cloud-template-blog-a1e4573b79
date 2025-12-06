'use strict';

/**
 * marketing controller
 */

module.exports = ({ strapi }) => ({
  /**
   * Envía newsletter a un email específico
   * Crea el contacto en Mailchimp y envía la campaña
   */
  async sendNewsletter(ctx) {
    try {
      const { email } = ctx.request.body;

      // Validar que el email esté presente
      if (!email) 
        return ctx.badRequest('El email es requerido');
      
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return ctx.badRequest('El formato del email no es válido');

      // Obtener configuración
      const campaignId = process.env.MAILCHIMP_CAMPAIGN_ID;
      if (!campaignId)
        return ctx.internalServerError('MAILCHIMP_CAMPAIGN_ID no está configurada');

      // Obtener servicio de marketing
      const marketingService = strapi.service('api::marketing.marketing');

      // Obtener el listId de la campaña
      const listId = await marketingService.getListIdFromCampaign(campaignId);

      // Crear contacto en Mailchimp
      await marketingService.createContact(email, listId);

      return ctx.send({
        success: true,
        message: 'Newsletter enviado exitosamente',
        data: {
          email,
          campaignId,
          listId,
        },
      });
    } catch (error) {
      strapi.log.error('Error al enviar newsletter:', error);

      // Manejar errores específicos de Mailchimp
      if (error.status === 404 || error.statusCode === 404) {
        return ctx.notFound('Campaña no encontrada: ' + error.message);
      }

      if (error.status === 401 || error.statusCode === 401) {
        return ctx.unauthorized('Error de autenticación. Verifica tu API key de Mailchimp o Transactional API');
      }

      return ctx.internalServerError({
        message: 'Error al enviar newsletter',
        error: error.message,
        details: error.response?.body || error,
      });
    }
  },

  /**
   * Envía un formulario de contacto a Mailchimp
   */
  async contact(ctx) {
    try {
      const { email, name, phone, description } = ctx.request.body;

      // Validar campos requeridos
      if (!email) {
        return ctx.badRequest('El email es requerido');
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ctx.badRequest('El formato del email no es válido');
      }

      // Obtener servicio de marketing
      const marketingService = strapi.service('api::marketing.marketing');

      // Enviar formulario a Mailchimp
      const result = await marketingService.submitContactForm({
        email,
        name: name || '',
        phone: phone || '',
        description: description || '',
      });

      return ctx.send({
        success: true,
        message: 'Formulario de contacto enviado exitosamente',
        data: {
          email,
          name,
          phone,
          result,
        },
      });
    } catch (error) {
      strapi.log.error('[Marketing] Error al enviar formulario de contacto:', error);

      return ctx.internalServerError({
        message: 'Error al enviar formulario de contacto',
        error: error.message,
      });
    }
  },
});

