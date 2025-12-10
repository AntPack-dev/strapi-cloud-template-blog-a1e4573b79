'use strict';

const mailchimp = require('@mailchimp/mailchimp_marketing');
const crypto = require('crypto');

/**
 * marketing service
 */

module.exports = ({ strapi }) => {
  /**
   * Inicializa el cliente de Mailchimp
   */
  const initMailchimp = () => {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    if (!apiKey) {
      throw new Error('MAILCHIMP_API_KEY no está configurada');
    }
    const serverPrefix = apiKey.split('-')[1];
    
    mailchimp.setConfig({
      apiKey: apiKey,
      server: serverPrefix,
    });
  };

  /**
   * Obtiene el hash del suscriptor para usar en las APIs
   * @param {string} email - Email del suscriptor
   * @returns {string} - MD5 hash del email
   */
  const getSubscriberHash = (email) => {
    return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  };

  return {
    /**
     * Lista las campañas de Mailchimp
     * @param {Object} options - Opciones para filtrar las campañas
     * @param {number} options.count - Número de campañas a retornar (default: 10, max: 1000)
     * @param {number} options.offset - Número de campañas a omitir
     * @param {string} options.status - Filtrar por estado: save, paused, schedule, sending, sent, canceled
     * @param {string} options.type - Filtrar por tipo: regular, plaintext, absplit, rss, variate
     * @param {string} options.sortField - Campo para ordenar: create_time, send_time
     * @param {string} options.sortDir - Dirección de orden: ASC, DESC
     * @returns {Promise<Object>} - Lista de campañas
     */
    async listCampaigns(options = {}) {
      try {
        initMailchimp();
        
        const params = {
          count: options.count || 10,
          offset: options.offset || 0,
        };

        if (options.status) {
          params.status = options.status;
        }

        if (options.type) {
          params.type = options.type;
        }

        if (options.sortField) {
          params.sort_field = options.sortField;
        }

        if (options.sortDir) {
          params.sort_dir = options.sortDir;
        }

        strapi.log.info('[Mailchimp] Listando campañas con parámetros:', params);

        const response = await mailchimp.campaigns.list(params);

        return {
          campaigns: response.campaigns || [],
          total_items: response.total_items || 0,
        };
      } catch (error) {
        strapi.log.error('[Mailchimp] Error al listar campañas:', error);
        throw new Error(`Error al listar campañas: ${error.message}`);
      }
    },

    /**
     * Obtiene el listId de una campaña
     * @param {string} campaignId - ID de la campaña
     * @returns {Promise<string>} - ID de la lista
     */
    async getListIdFromCampaign(campaignId) {
      try {
        initMailchimp();
        const campaign = await mailchimp.campaigns.get(campaignId);
        return campaign.recipients.list_id;
      } catch (error) {
        throw new Error(`Error al obtener información de la campaña: ${error.message}`);
      }
    },

    /**
     * Crea o actualiza un contacto en Mailchimp
     * @param {string} email - Email del contacto
     * @param {string} listId - ID de la lista de Mailchimp
     * @returns {Promise<Object>} - Respuesta de Mailchimp
     */
    async createContact(email, listId) {
      try {
        initMailchimp();
        
        const response = await mailchimp.lists.addListMember(listId, {
          email_address: email,
          status: 'pending',
        });

        return response;
      } catch (error) {
        // Si el contacto ya existe, intentar actualizarlo
        if (error.status === 400 && error.response?.body?.title === 'Member Exists') {
          try {
            const subscriberHash = getSubscriberHash(email);
            const response = await mailchimp.lists.updateListMember(listId, subscriberHash, {
              status: 'subscribed',
            });
            return response;
          } catch (updateError) {
            throw updateError;
          }
        }
        throw error;
      }
    },

    /**
     * Submit contact form to Mailchimp using the subscription endpoint
     * @param {Object} contactData - Datos del contacto
     * @param {string} contactData.email - Email
     * @param {string} contactData.name - Name
     * @param {string} contactData.phone - Phone
     * @param {string} contactData.description - Description
     * @returns {Promise<Object>} - Mailchimp response
     */
    async submitContactForm(contactData) {
      try {
        const { email, name, phone, description } = contactData;

        const mailchimpUrl = 'https://antpack.us19.list-manage.com/subscribe/post?u=1f207d6d7e9745dca48c572fd&id=981ba743b6&f_id=00f2c2e1f0';

        // Create form data
        const formData = new URLSearchParams();
        formData.append('EMAIL', email || '');
        formData.append('FNAME', name || '');
        formData.append('PHONE', phone || '');
        formData.append('DESCRIPT', description || '');
        formData.append('b_1f207d6d7e9745dca48c572fd_981ba743b6', '');
        formData.append('subscribe', 'Subscribe');

        const response = await fetch(mailchimpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (response.ok || response.status === 302) {
          return {
            success: true,
            message: 'Formulario enviado exitosamente',
            status: response.status,
            url: response.url,
          };
        }

        throw new Error(`Error al enviar formulario: ${response.status} ${response.statusText}`);
      } catch (error) {
        strapi.log.error('[Mailchimp] Error al enviar formulario de contacto:', error);
        throw error;
      }
    },

    /**
     * Submit interest form to Mailchimp using the subscription endpoint
     * @param {Object} interestData - Interest data
     * @param {string} interestData.email - Email
     * @param {string} interestData.country - Country
     * @param {string} interestData.description - Description
     * @returns {Promise<Object>} - Mailchimp response
     */
    async submitInterestForm(interestData) {
      try {
        const { email, country, description } = interestData;

        const mailchimpUrl = 'https://antpack.us19.list-manage.com/subscribe/post?u=1f207d6d7e9745dca48c572fd&id=981ba743b6&f_id=00f1c2e1f0';

        // Create form data
        const formData = new URLSearchParams();
        formData.append('EMAIL', email || '');
        formData.append('COUNTRY', country || '');
        formData.append('DESCRIPT', description || '');
        formData.append('b_1f207d6d7e9745dca48c572fd_981ba743b6', '');
        // formData.append('subscribe', 'Subscribe');
        formData.append('tags', '133');

        const response = await fetch(mailchimpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (response.ok || response.status === 302) {
          return {
            success: true,
            message: 'Formulario enviado exitosamente',
            status: response.status,
            url: response.url,
          };
        }

        throw new Error(`Error al enviar formulario: ${response.status} ${response.statusText}`);
      } catch (error) {
        strapi.log.error('[Mailchimp] Error al enviar formulario de contacto:', error);
        throw error;
      }
    },
  };
};

