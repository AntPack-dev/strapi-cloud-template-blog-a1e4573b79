'use strict';

/**
 *  article controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    // Verificar si se solicita incluir likesCount y/o commentsCount
    const { includeLikesCount, includeCommentsCount } = ctx.query;
    
    if (includeLikesCount === 'true' || includeCommentsCount === 'true') {
      try {
        // Usar el método estándar primero para obtener los artículos
        const response = await super.find(ctx);
        
        // Para cada artículo, contar los likes y/o comments
        const articlesWithCount = await Promise.all(
          response.data.map(async (article) => {
            let likesCount = 0;
            let commentsCount = 0;

            // Contar likes si se solicita
            if (includeLikesCount === 'true') {
              likesCount = await strapi.db.query('api::like.like').count({
                where: { article: article.id },
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

  // Métodos adicionales para likes count
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
}));
