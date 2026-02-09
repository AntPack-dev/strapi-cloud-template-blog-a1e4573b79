'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::comment.comment', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to comment');
    }

    try {
      // Crear el comentario manualmente en la base de datos
      const comment = await strapi.db.query('api::comment.comment').create({
        data: {
          content: data.content,
          article: data.article_id || data.article,
          author: userId,
        },
        populate: ['article', 'author'],
      });

      return ctx.send({
        data: comment,
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      return ctx.badRequest('Error creating comment');
    }
  },

  async update(ctx) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to update comments');
    }

    try {
      // Verificar que el comentario exista y pertenezca al usuario
      const existingComment = await strapi.db.query('api::comment.comment').findOne({
        where: { id },
        populate: ['author'],
      });

      if (!existingComment) {
        return ctx.notFound('Comment not found');
      }

      if (existingComment.author.id !== userId) {
        return ctx.forbidden('You can only update your own comments');
      }

      // Actualizar el comentario
      const updatedComment = await strapi.db.query('api::comment.comment').update({
        where: { id },
        data: {
          content: data.content,
        },
        populate: ['article', 'author'],
      });

      return ctx.send({
        data: updatedComment,
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      return ctx.badRequest('Error updating comment');
    }
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to delete comments');
    }

    try {
      // Verificar que el comentario exista y pertenezca al usuario
      const existingComment = await strapi.db.query('api::comment.comment').findOne({
        where: { id },
        populate: ['author'],
      });

      if (!existingComment) {
        return ctx.notFound('Comment not found');
      }

      if (existingComment.author.id !== userId) {
        return ctx.forbidden('You can only delete your own comments');
      }

      // Eliminar el comentario
      await strapi.db.query('api::comment.comment').delete({
        where: { id },
      });

      return ctx.send({
        message: 'Comment deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      return ctx.badRequest('Error deleting comment');
    }
  },
}));
