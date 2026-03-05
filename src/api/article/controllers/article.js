'use strict';

/**
 *  article controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    // Verificar si se solicita incluir likesCount, interactionsCount y/o commentsCount
    const { includeLikesCount, includeInteractionsCount, includeCommentsCount } = ctx.query;
    
    if (includeLikesCount === 'true' || includeInteractionsCount === 'true' || includeCommentsCount === 'true') {
      try {
        // Usar el método estándar primero para obtener los artículos
        const response = await super.find(ctx);
        
        // Para cada artículo, contar las interacciones y/o comments
        const articlesWithCount = await Promise.all(
          response.data.map(async (article) => {
            let likesCount = 0;
            let meGustaCount = 0;
            let meInteresaCount = 0;
            let commentsCount = 0;

            // Contar likes si se solicita (mantiene compatibilidad)
            if (includeLikesCount === 'true') {
              likesCount = await strapi.db.query('api::like.like').count({
                where: { article: article.id },
              });
            }

            // Contar interacciones si se solicita
            if (includeInteractionsCount === 'true') {
              meGustaCount = await strapi.db.query('api::like.like').count({
                where: { article: article.id, type: 'me_gusta' },
              });
              meInteresaCount = await strapi.db.query('api::like.like').count({
                where: { article: article.id, type: 'me_interesa' },
              });
            }

            // Contar comments si se solicita
            if (includeCommentsCount === 'true') {
              commentsCount = await strapi.db.query('api::comment.comment').count({
                where: { article: article.id },
              });
            }

            const result = { ...article };
            if (includeLikesCount === 'true') {
              result.likesCount = likesCount;
            }
            if (includeInteractionsCount === 'true') {
              result.meGustaCount = meGustaCount;
              result.meInteresaCount = meInteresaCount;
              result.totalInteractionsCount = meGustaCount + meInteresaCount;
            }
            if (includeCommentsCount === 'true') {
              result.commentsCount = commentsCount;
            }

            return result;
          })
        );

        return ctx.send({
          data: articlesWithCount,
          meta: response.meta,
        });
      } catch (error) {
        console.error('Error fetching articles with counts:', error);
        return ctx.badRequest('Error fetching articles');
      }
    } else {
      // Usar el método estándar si no se solicita counts
      return super.find(ctx);
    }
  },

  async toggleInteraction(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;
    const { type = 'me_gusta' } = ctx.request.body;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to interact with articles');
    }

    // Validar que el tipo de interacción sea válido
    if (!['me_gusta', 'me_interesa'].includes(type)) {
      return ctx.badRequest('Invalid interaction type. Must be "me_gusta" or "me_interesa"');
    }

    try {
      const existingInteraction = await strapi.db.query('api::like.like').findOne({
        where: {
          article: id,
          user: userId,
          type: type,
        },
      });

      if (existingInteraction) {
        await strapi.db.query('api::like.like').delete({
          where: { id: existingInteraction.id },
        });

        return ctx.send({
          message: `${type.replace('_', ' ')} removed`,
          interacted: false,
          type: type,
        });
      } else {
        await strapi.db.query('api::like.like').create({
          data: {
            article: id,
            user: userId,
            type: type,
          },
        });

        return ctx.send({
          message: `Article ${type.replace('_', ' ')}d`,
          interacted: true,
          type: type,
        });
      }
    } catch (error) {
      console.error('Error toggling interaction:', error);
      return ctx.badRequest('An error occurred while toggling interaction');
    }
  },

  // Mantener el método antiguo para compatibilidad
  async toggleLike(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to like articles');
    }

    try {
      const existingLike = await strapi.db.query('api::like.like').findOne({
        where: {
          article: id,
          user: userId,
          type: 'me_gusta',
        },
      });

      if (existingLike) {
        await strapi.db.query('api::like.like').delete({
          where: { id: existingLike.id },
        });

        return ctx.send({
          message: 'Like removed',
          liked: false,
        });
      } else {
        await strapi.db.query('api::like.like').create({
          data: {
            article: id,
            user: userId,
            type: 'me_gusta',
          },
        });

        return ctx.send({
          message: 'Article liked',
          liked: true,
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      return ctx.badRequest('An error occurred while toggling like');
    }
  },

  // Métodos adicionales para interacciones count
  async findWithInteractionsCount(ctx) {
    const { includeCommentsCount, includeLikesCount } = ctx.query;
    
    try {
      // Versión simplificada para debug
      const articles = await strapi.db.query('api::article.article').findMany();

      // Para cada artículo, contar las interacciones y/o comments
      const articlesWithCount = await Promise.all(
        articles.map(async (article) => {
          let meGustaCount = 0;
          let meInteresaCount = 0;
          let likesCount = 0;

          // Contar interacciones
          meGustaCount = await strapi.db.query('api::like.like').count({
            where: { article: article.id, type: 'me_gusta' },
          });
          meInteresaCount = await strapi.db.query('api::like.like').count({
            where: { article: article.id, type: 'me_interesa' },
          });

          // Contar likes totales si se solicita (compatibilidad)
          if (includeLikesCount === 'true') {
            likesCount = await strapi.db.query('api::like.like').count({
              where: { article: article.id },
            });
          }

          const result = {
            ...article,
            meGustaCount: meGustaCount,
            meInteresaCount: meInteresaCount,
            totalInteractionsCount: meGustaCount + meInteresaCount,
          };

          // Agregar likesCount si se solicita (compatibilidad)
          if (includeLikesCount === 'true') {
            result.likesCount = likesCount;
          }

          // Agregar commentsCount si se solicita
          if (includeCommentsCount === 'true') {
            const commentsCount = await strapi.db.query('api::comment.comment').count({
              where: { article: article.id },
            });
            result.commentsCount = commentsCount;
          }

          return result;
        })
      );

      return ctx.send({
        data: articlesWithCount,
        meta: {
          total: articlesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Error fetching articles with counts:', error);
      return ctx.badRequest('Error fetching articles');
    }
  },

  // Mantener compatibilidad con el método antiguo
  async findWithLikesCount(ctx) {
    const { includeCommentsCount } = ctx.query;
    
    try {
      // Versión simplificada para debug
      const articles = await strapi.db.query('api::article.article').findMany();

      // Para cada artículo, contar los likes y/o comments
      const articlesWithCount = await Promise.all(
        articles.map(async (article) => {
          const likesCount = await strapi.db.query('api::like.like').count({
            where: { article: article.id },
          });

          const result = {
            ...article,
            likesCount: likesCount,
          };

          // Agregar commentsCount si se solicita
          if (includeCommentsCount === 'true') {
            const commentsCount = await strapi.db.query('api::comment.comment').count({
              where: { article: article.id },
            });
            result.commentsCount = commentsCount;
          }

          return result;
        })
      );

      return ctx.send({
        data: articlesWithCount,
        meta: {
          total: articlesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Error fetching articles with counts:', error);
      return ctx.badRequest('Error fetching articles');
    }
  },

  async findOneWithInteractionsCount(ctx) {
    const { id } = ctx.params;
    const { populate, includeCommentsCount, includeLikesCount } = ctx.query;

    try {
      // Construir parámetros de populate
      const populateParams = {};
      if (populate) {
        if (typeof populate === 'string') {
          populateParams.populate = populate;
        } else if (Array.isArray(populate)) {
          populateParams.populate = populate.join(',');
        }
      }

      // Obtener el artículo con populate dinámico
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        populate: populateParams.populate || '*',
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Contar las interacciones para este artículo
      const meGustaCount = await strapi.db.query('api::like.like').count({
        where: { article: id, type: 'me_gusta' },
      });
      const meInteresaCount = await strapi.db.query('api::like.like').count({
        where: { article: id, type: 'me_interesa' },
      });

      // Devolver el artículo con los conteos
      const articleWithCount = {
        ...article,
        meGustaCount: meGustaCount,
        meInteresaCount: meInteresaCount,
        totalInteractionsCount: meGustaCount + meInteresaCount,
      };

      // Agregar likesCount si se solicita (compatibilidad)
      if (includeLikesCount === 'true') {
        const likesCount = await strapi.db.query('api::like.like').count({
          where: { article: id },
        });
        articleWithCount.likesCount = likesCount;
      }

      // Agregar commentsCount si se solicita
      if (includeCommentsCount === 'true') {
        const commentsCount = await strapi.db.query('api::comment.comment').count({
          where: { article: id },
        });
        articleWithCount.commentsCount = commentsCount;
      }

      return ctx.send({
        data: articleWithCount,
      });
    } catch (error) {
      console.error('Error fetching article with counts:', error);
      return ctx.badRequest('Error fetching article');
    }
  },

  // Mantener compatibilidad con el método antiguo
  async findOneWithLikesCount(ctx) {
    const { id } = ctx.params;
    const { populate, includeCommentsCount } = ctx.query;

    try {
      // Construir parámetros de populate
      const populateParams = {};
      if (populate) {
        if (typeof populate === 'string') {
          populateParams.populate = populate;
        } else if (Array.isArray(populate)) {
          populateParams.populate = populate.join(',');
        }
      }

      // Obtener el artículo con populate dinámico
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        populate: populateParams.populate || '*',
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Contar los likes para este artículo
      const likesCount = await strapi.db.query('api::like.like').count({
        where: { article: id },
      });

      // Devolver el artículo con el conteo
      const articleWithCount = {
        ...article,
        likesCount: likesCount,
      };

      // Agregar commentsCount si se solicita
      if (includeCommentsCount === 'true') {
        const commentsCount = await strapi.db.query('api::comment.comment').count({
          where: { article: id },
        });
        articleWithCount.commentsCount = commentsCount;
      }

      return ctx.send({
        data: articleWithCount,
      });
    } catch (error) {
      console.error('Error fetching article with counts:', error);
      return ctx.badRequest('Error fetching article');
    }
  },

  // Obtener artículo con información de interacción del usuario
  async findOneWithUserInteraction(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    try {
      // Obtener el artículo solo con campos básicos (sin relaciones pesadas)
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        select: [
          'id', 
          'title', 
          'slug', 
          'description', 
          'isFeatured',
          'isFeaturedMain',
          'currentStatus',
          'readingTime',
          'creationDate',
          'publishedAt', 
          'createdAt', 
          'updatedAt'
        ]
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Inicializar objeto de respuesta
      const articleWithInteraction = {
        ...article,
        userInteraction: {
          hasLiked: false,
          hasCommented: false,
          likedTypes: []
        }
      };

      // Si el usuario está autenticado, verificar sus interacciones
      if (userId) {
        // Verificar si el usuario ha dado like a este artículo (cualquier tipo)
        const userLikes = await strapi.db.query('api::like.like').findMany({
          where: {
            article: id,
            user: userId
          },
          populate: ['type']
        });

        // Verificar si el usuario ha comentado en este artículo
        const userComment = await strapi.db.query('api::comment.comment').findOne({
          where: {
            article: id,
            author: userId
          }
        });

        // Actualizar información de interacción
        articleWithInteraction.userInteraction = {
          hasLiked: userLikes.length > 0,
          hasCommented: !!userComment,
          likedTypes: userLikes.map(like => ({
            id: like.type?.id,
            code: like.type?.code,
            displayName: like.type?.display_name,
            icon: like.type?.icon,
            color: like.type?.color
          }))
        };
      }

      return ctx.send({
        data: articleWithInteraction,
      });
    } catch (error) {
      console.error('Error fetching article with user interaction:', error);
      return ctx.badRequest('Error fetching article');
    }
  },
}));
