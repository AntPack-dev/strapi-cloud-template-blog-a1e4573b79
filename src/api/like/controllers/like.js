'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::like.like', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to like articles');
    }

    try {
      // Verificar si ya existe un like de este usuario para este artículo
      const existingLike = await strapi.db.query('api::like.like').findOne({
        where: {
          article: data.article_id || data.article,
          user: userId,
        },
      });

      if (existingLike) {
        return ctx.badRequest('You have already liked this article');
      }

      // Crear el like
      const like = await strapi.db.query('api::like.like').create({
        data: {
          article: data.article_id || data.article,
          user: userId,
        },
        populate: ['article', 'user'],
      });

      return ctx.send({
        data: like,
      });
    } catch (error) {
      console.error('Error creating like:', error);
      return ctx.badRequest('Error creating like');
    }
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to delete likes');
    }

    try {
      // Verificar que el like exista y pertenezca al usuario
      const existingLike = await strapi.db.query('api::like.like').findOne({
        where: { id },
        populate: ['user'],
      });

      if (!existingLike) {
        return ctx.notFound('Like not found');
      }

      if (existingLike.user.id !== userId) {
        return ctx.forbidden('You can only delete your own likes');
      }

      // Eliminar el like
      await strapi.db.query('api::like.like').delete({
        where: { id },
      });

      return ctx.send({
        message: 'Like deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting like:', error);
      return ctx.badRequest('Error deleting like');
    }
  },

  async find(ctx) {
    const userId = ctx.state.user?.id;
    const { articleId } = ctx.query;

    try {
      let whereClause = {};
      
      // Si se especifica un articleId, filtrar por ese artículo
      if (articleId) {
        whereClause.article = articleId;
      }
      
      // Si el usuario está logueado, puede ver todos los likes
      // Si no, solo puede ver likes públicos (sin filtros de usuario)

      const likes = await strapi.db.query('api::like.like').findMany({
        where: whereClause,
        populate: ['article', 'user'],
        sort: { createdAt: 'desc' },
      });

      return ctx.send({
        data: likes,
        meta: {
          total: likes.length,
        },
      });
    } catch (error) {
      console.error('Error fetching likes:', error);
      return ctx.badRequest('Error fetching likes');
    }
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    try {
      const like = await strapi.db.query('api::like.like').findOne({
        where: { id },
        populate: ['article', 'user'],
      });

      if (!like) {
        return ctx.notFound('Like not found');
      }

      // Si el usuario no es el dueño del like, no mostrar información sensible
      if (userId !== like.user.id) {
        // Devolver versión pública del like (sin datos del usuario)
        const publicLike = {
          id: like.id,
          article: like.article,
          createdAt: like.createdAt,
        };
        return ctx.send({ data: publicLike });
      }

      return ctx.send({ data: like });
    } catch (error) {
      console.error('Error fetching like:', error);
      return ctx.badRequest('Error fetching like');
    }
  },

  async toggleLike(ctx) {
    const { id } = ctx.params; // id del artículo
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
}));
