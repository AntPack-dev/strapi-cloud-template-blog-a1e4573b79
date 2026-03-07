'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::like.like', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;
    const userId = ctx.state.user?.id;
    const typeId = data.type;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to interact with articles');
    }

    if (!typeId) {
      return ctx.badRequest('Interaction type is required');
    }

    try {
      // Verificar que el tipo de interacción existe y está activo
      const interactionType = await strapi.db.query('api::interaction-types.interaction-type').findOne({
        where: { id: typeId, active: true }
      });

      if (!interactionType) {
        return ctx.badRequest('Invalid interaction type');
      }

      // Verificar si ya existe una interacción del mismo tipo de este usuario para este artículo
      const existingInteraction = await strapi.db.query('api::like.like').findOne({
        where: {
          article: data.article_id || data.article,
          user: userId,
          type: typeId,
        },
      });

      if (existingInteraction) {
        return ctx.badRequest(`You have already ${interactionType.display_name.toLowerCase()}d this article`);
      }

      // Crear la interacción
      const interaction = await strapi.db.query('api::like.like').create({
        data: {
          article: data.article_id || data.article,
          user: userId,
          type: typeId,
        },
        populate: ['article', 'user', 'type'],
      });

      return ctx.send({
        data: interaction,
      });
    } catch (error) {
      console.error('Error creating interaction:', error);
      return ctx.badRequest('Error creating interaction');
    }
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to delete interactions');
    }

    try {
      // Verificar que la interacción exista y pertenezca al usuario
      const existingInteraction = await strapi.db.query('api::like.like').findOne({
        where: { id },
        populate: ['user'],
      });

      if (!existingInteraction) {
        return ctx.notFound('Interaction not found');
      }

      if (existingInteraction.user.id !== userId) {
        return ctx.forbidden('You can only delete your own interactions');
      }

      // Eliminar la interacción
      await strapi.db.query('api::like.like').delete({
        where: { id },
      });

      return ctx.send({
        message: 'Interaction deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting interaction:', error);
      return ctx.badRequest('Error deleting interaction');
    }
  },

  async find(ctx) {
    const userId = ctx.state.user?.id;
    const { articleId, type } = ctx.query;

    try {
      let whereClause = {};
      
      // Si se especifica un articleId, filtrar por ese artículo
      if (articleId) {
        whereClause.article = articleId;
      }
      
      // Si se especifica un tipo (ID), filtrar por ese tipo
      if (type) {
        // Verificar que el tipo existe y está activo
        const interactionType = await strapi.db.query('api::interaction-types.interaction-type').findOne({
          where: { id: type, active: true }
        });
        
        if (!interactionType) {
          return ctx.badRequest('Invalid interaction type');
        }
        whereClause.type = type;
      }
      
      // Si el usuario está logueado, puede ver todas las interacciones
      // Si no, solo puede ver interacciones públicas (sin filtros de usuario)

      const interactions = await strapi.db.query('api::like.like').findMany({
        where: whereClause,
        populate: ['article', 'user', 'type'],
        sort: { createdAt: 'desc' },
      });

      return ctx.send({
        data: interactions,
        meta: {
          total: interactions.length,
        },
      });
    } catch (error) {
      console.error('Error fetching interactions:', error);
      return ctx.badRequest('Error fetching interactions');
    }
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    try {
      const interaction = await strapi.db.query('api::like.like').findOne({
        where: { id },
        populate: ['article', 'user'],
      });

      if (!interaction) {
        return ctx.notFound('Interaction not found');
      }

      // Si el usuario no es el dueño de la interacción, no mostrar información sensible
      if (userId !== interaction.user.id) {
        // Devolver versión pública de la interacción (sin datos del usuario)
        const publicInteraction = {
          id: interaction.id,
          article: interaction.article,
          type: interaction.type,
          createdAt: interaction.createdAt,
        };
        return ctx.send({ data: publicInteraction });
      }

      return ctx.send({ data: interaction });
    } catch (error) {
      console.error('Error fetching interaction:', error);
      return ctx.badRequest('Error fetching interaction');
    }
  },

  async toggleInteraction(ctx) {
    const userId = ctx.state.user?.id;
    const { articleId, type } = ctx.request.body;
    let article = null;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to interact with articles');
    }

    if (!articleId) {
      return ctx.badRequest('Article ID is required');
    }

    if (!type) {
      return ctx.badRequest('Interaction type is required');
    }

    try {
      const typeId = parseInt(type, 10);

      if (isNaN(typeId)) {
        return ctx.badRequest('Invalid interaction type ID');
      }

      // Validación del artículo - intentar por documentId primero, luego por id
      // Usar entityService en lugar de db.query para evitar problemas de permisos
      
      // Si articleId es un string (documentId), buscar por documentId
      if (typeof articleId === 'string' && isNaN(parseInt(articleId))) {
        article = await strapi.entityService.findMany('api::article.article', {
          filters: { documentId: articleId },
          fields: ['id', 'documentId'],
          publicationState: 'preview'
        });
        article = article && article.length > 0 ? article[0] : null;
      } else {
        // Si es un número o string numérico, buscar por id
        const numericId = parseInt(articleId);
        if (!isNaN(numericId)) {
          article = await strapi.entityService.findMany('api::article.article', {
            filters: { id: numericId },
            fields: ['id', 'documentId'],
            publicationState: 'preview'
          });
          article = article && article.length > 0 ? article[0] : null;
        }
      }

      if (!article) {
        return ctx.badRequest('Article not found');
      }
      
      // Usar el id numérico del artículo para las operaciones de base de datos
      const articleNumericId = article.id;

      // Validación simple del tipo de interacción
      const interactionType = await strapi.db.query('api::interaction-types.interaction-type').findOne({
        where: { id: typeId }
      });

      if (!interactionType) {
        return ctx.badRequest('Invalid interaction type');
      }

      // Verificar si el usuario ya tiene CUALQUIER interacción con este artículo
      // Usamos raw SQL para evitar problemas con relaciones huérfanas
      let existingInteractionRaw = null;
      try {
        const result = await strapi.db.connection.raw(`
          SELECT l.id, l.type_id 
          FROM likes l
          INNER JOIN likes_article_lnk la ON l.id = la.like_id
          INNER JOIN likes_user_lnk lu ON l.id = lu.like_id
          WHERE la.article_id = ? AND lu.user_id = ?
          LIMIT 1
        `, [articleNumericId, userId]);
        
        if (result.rows && result.rows.length > 0) {
          existingInteractionRaw = {
            id: result.rows[0].id,
            type_id: result.rows[0].type_id
          };
        }
      } catch (sqlError) {
        // Si SQL falla, intentar con el método normal pero sin populate
        try {
          existingInteractionRaw = await strapi.db.query('api::like.like').findOne({
            where: {
              article: articleNumericId,
              user: userId,
            }
          });
        } catch (queryError) {
          // Si todo falla, asumir que no existe
          existingInteractionRaw = null;
        }
      }

      if (existingInteractionRaw) {
        // Si tenemos type_id directo, usarlo
        if (existingInteractionRaw.type_id) {
          if (existingInteractionRaw.type_id === typeId) {
            // Mismo tipo - eliminar con raw SQL
            try {
              await strapi.db.connection.raw(`
                DELETE FROM likes WHERE id = ?
              `, [existingInteractionRaw.id]);

              return ctx.send({
                message: `${interactionType.display_name} removed`,
                interacted: false,
                typeId: typeId,
                typeInfo: {
                  id: interactionType.id,
                  code: interactionType.code,
                  display_name: interactionType.display_name,
                  icon: interactionType.icon,
                  color: interactionType.color
                }
              });
            } catch (deleteError) {
              // Si SQL falla, intentar con query
              try {
                await strapi.db.query('api::like.like').delete({
                  where: { id: existingInteractionRaw.id }
                });
              } catch (queryDeleteError) {
                // Si no se puede eliminar, devolver error simple
                return ctx.badRequest('Cannot remove interaction. Please try again.');
              }
            }
          } else {
            // Diferente tipo - actualizar con raw SQL
            try {
              await strapi.db.connection.raw(`
                UPDATE likes SET type_id = ? WHERE id = ?
              `, [typeId, existingInteractionRaw.id]);

              return ctx.send({
                message: `Interaction changed to ${interactionType.display_name}`,
                interacted: true,
                typeId: typeId,
                typeInfo: {
                  id: interactionType.id,
                  code: interactionType.code,
                  display_name: interactionType.display_name,
                  icon: interactionType.icon,
                  color: interactionType.color
                }
              });
            } catch (updateError) {
              // Si SQL falla, intentar con query
              try {
                await strapi.db.query('api::like.like').update({
                  where: { id: existingInteractionRaw.id },
                  data: { type: typeId }
                });
              } catch (queryUpdateError) {
                // Si no se puede actualizar, eliminar y crear nueva
                try {
                  await strapi.db.query('api::like.like').delete({
                    where: { id: existingInteractionRaw.id }
                  });
                } catch (deleteError) {
                  // Ignorar error de eliminación
                }
                
                // Crear nueva (continuará al else block)
                existingInteractionRaw = null;
              }
            }
          }
        } else {
          // No tiene type_id - eliminar y crear nueva
          try {
            await strapi.db.query('api::like.like').delete({
              where: { id: existingInteractionRaw.id }
            });
          } catch (deleteError) {
            // Ignorar error
          }
          existingInteractionRaw = null;
        }
      }

      if (!existingInteractionRaw) {
        // Crear nueva interacción con raw SQL para evitar problemas
        try {
          // Generar document_id único
          const crypto = require('crypto');
          const documentId = crypto.randomBytes(13).toString('base64url').substring(0, 25);

          const result = await strapi.db.connection.raw(`
            INSERT INTO likes (document_id, type_id, published_at, created_at, updated_at)
            VALUES (?, ?, NOW(), NOW(), NOW())
            RETURNING id
          `, [documentId, typeId]);

          const likeId = result.rows[0].id;

          // Insertar relaciones
          await strapi.db.connection.raw(`
            INSERT INTO likes_article_lnk (like_id, article_id)
            VALUES (?, ?)
          `, [likeId, articleNumericId]);

          await strapi.db.connection.raw(`
            INSERT INTO likes_user_lnk (like_id, user_id)
            VALUES (?, ?)
          `, [likeId, userId]);

          return ctx.send({
            message: `Interaction added`,
            interacted: true,
            typeId: typeId,
            typeInfo: {
              id: interactionType.id,
              code: interactionType.code,
              display_name: interactionType.display_name,
              icon: interactionType.icon,
              color: interactionType.color
            }
          });
        } catch (createError) {
          // Si SQL falla, intentar con el método normal
          try {
            const newInteraction = await strapi.db.query('api::like.like').create({
              data: {
                article: articleNumericId,
                user: userId,
                type: typeId,
              }
            });

            return ctx.send({
              message: `Interaction added`,
              interacted: true,
              typeId: typeId,
              typeInfo: {
                id: interactionType.id,
                code: interactionType.code,
                display_name: interactionType.display_name,
                icon: interactionType.icon,
                color: interactionType.color
              }
            });
          } catch (queryCreateError) {
            return ctx.badRequest('Cannot create interaction. Please contact administrator.');
          }
        }
      }
    } catch (error) {
      console.error('Error toggling interaction:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        details: error.details
      });
      console.error('Request data:', { articleId, articleNumericId: article?.id, type, userId });
      
      // Si es un error de base de datos, dar más contexto
      if (error.message.includes('database') || error.message.includes('SQL') || error.message.includes('constraint')) {
        return ctx.badRequest('Database error: Unable to process interaction. Please check if the article and interaction type exist.');
      }
      
      // Si es un error de relación
      if (error.message.includes('relation') || error.message.includes('foreign key')) {
        return ctx.badRequest('Relation error: Invalid article or interaction type.');
      }
      
      return ctx.badRequest('Error toggling interaction: ' + error.message);
    }
  },

  async getMyInteractions(ctx) {
    const userId = ctx.state.user?.id;
    const { type, articleId, search } = ctx.query;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to view your interactions');
    }

    try {
      // Construir where clause
      const whereClause = { user: userId };

      if (type) {
        whereClause.type = type;
      }

      if (articleId) {
        whereClause.article = articleId;
      }

      // Usar db.query con populate
      const interactions = await strapi.db.query('api::like.like').findMany({
        where: whereClause,
        populate: {
          article: {
            populate: ['cover', 'category', 'author', 'main_category']
          },
          type: true,
          user: {
            select: ['id', 'username', 'email', 'firstName', 'lastName']
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      // Filtrar resultados basados en parámetro de búsqueda
      let filteredInteractions = interactions;

      // Búsqueda unificada: nombre de artículo, nombre de categoría, o nombre de main category
      if (search) {
        // Función para normalizar texto (quitar acentos y caracteres especiales)
        const normalizeText = (text) => {
          return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar diacríticos (acentos)
            .replace(/[¡!¿?]/g, '') // Quitar signos de interrogación y exclamación
            .replace(/[^\w\s]/g, '') // Quitar caracteres especiales excepto espacios y alfanuméricos
            .trim();
        };
        
        const normalizedSearchTerm = normalizeText(search);
        
        filteredInteractions = filteredInteractions.filter(interaction => {
          if (!interaction.article) return false;
          
          const article = interaction.article;
          
          // Buscar en título del artículo (normalizado)
          const titleMatch = article.title && 
            normalizeText(article.title).includes(normalizedSearchTerm);
          
          // Buscar en nombre de categoría (normalizado)
          const categoryMatch = article.category && 
            article.category.name && 
            normalizeText(article.category.name).includes(normalizedSearchTerm);
          
          // Buscar en nombre de main category (normalizado)
          const mainCategoryMatch = article.main_category && 
            article.main_category.name && 
            normalizeText(article.main_category.name).includes(normalizedSearchTerm);
          
          // Retornar si coincide con alguno de los tres campos
          return titleMatch || categoryMatch || mainCategoryMatch;
        });
      }

      // Enriquecer cada interacción con conteos y estado del usuario
      const enrichedInteractions = await Promise.all(
        filteredInteractions.map(async (interaction) => {
          if (!interaction.article) return interaction;

          const articleId = interaction.article.id;

          // Contar likes del artículo
          const likesCount = await strapi.db.query('api::like.like').count({
            where: { article: articleId }
          });

          // Contar comentarios del artículo
          const commentsCount = await strapi.db.query('api::comment.comment').count({
            where: { article: articleId }
          });

          // Verificar si el usuario ya dio like a este artículo
          const userLike = await strapi.db.query('api::like.like').findOne({
            where: { 
              article: articleId,
              user: userId 
            }
          });

          // Verificar si el usuario ya comentó en este artículo
          const userComment = await strapi.db.query('api::comment.comment').findOne({
            where: { 
              article: articleId,
              author: userId 
            }
          });

          return {
            ...interaction,
            article: {
              ...interaction.article,
              stats: {
                likesCount,
                commentsCount
              },
              userInteraction: {
                liked: !!userLike,
                commented: !!userComment
              }
            }
          };
        })
      );

      return ctx.send({
        data: enrichedInteractions,
        meta: {
          total: enrichedInteractions.length,
          filters: {
            search,
            type,
            articleId
          }
        },
      });
    } catch (error) {
      console.error('Error fetching user interactions:', error);
      return ctx.badRequest('Error fetching user interactions');
    }
  },

  }));
