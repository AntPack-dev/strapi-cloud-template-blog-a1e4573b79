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

  // Obtener comentarios de un artículo específico
  async getCommentsByArticle(ctx) {
    const { articleId } = ctx.params;
    const { page = 1, limit = 10 } = ctx.query;

    if (!articleId) {
      return ctx.badRequest('Article ID is required');
    }

    try {
      // Verificar que el artículo existe - usar db.query directamente
      let article = null;
      
      // Si articleId es un string no numérico (documentId), buscar por documentId
      if (typeof articleId === 'string' && isNaN(parseInt(articleId))) {
        article = await strapi.db.query('api::article.article').findOne({
          where: { documentId: articleId },
          select: ['id', 'documentId']
        });
      } else {
        // Si es un número o string numérico, buscar por id
        const numericId = parseInt(articleId);
        if (!isNaN(numericId)) {
          article = await strapi.db.query('api::article.article').findOne({
            where: { id: numericId },
            select: ['id', 'documentId']
          });
        }
      }

      if (!article) {
        return ctx.notFound('Article not found');
      }
      
      const articleNumericId = article.id;

      // Convertir a números
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Obtener comentarios con paginación, filtrando por usuarios activos
      const comments = await strapi.db.query('api::comment.comment').findMany({
        where: {
          article: articleNumericId,
          author: {
            statusProfile: 'active'
          }
        },
        populate: {
          author: {
            select: ['id', 'username', 'firstName', 'lastName'],
            where: {
              statusProfile: 'active'
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        limit: limitNum,
        offset: offset
      });

      // Contar total de comentarios para paginación (solo de usuarios activos)
      const total = await strapi.db.query('api::comment.comment').count({
        where: {
          article: articleNumericId,
          author: {
            statusProfile: 'active'
          }
        }
      });

      return ctx.send({
        data: comments,
        meta: {
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: total,
            pageCount: Math.ceil(total / limitNum)
          }
        }
      });

    } catch (error) {
      console.error('Error fetching comments:', error);
      return ctx.badRequest('Error fetching comments');
    }
  },

  // Obtener comentarios del usuario autenticado
  async getMyComments(ctx) {
    const userId = ctx.state.user?.id;
    const { page = 1, limit = 10 } = ctx.query;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to view your comments');
    }

    try {
      // Convertir a números
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Obtener comentarios del usuario con paginación
      const comments = await strapi.db.query('api::comment.comment').findMany({
        where: {
          author: userId
        },
        populate: {
          article: {
            select: ['id', 'title', 'slug']
          },
          author: {
            select: ['id', 'username', 'firstName', 'lastName']
          }
        },
        orderBy: { createdAt: 'desc' },
        limit: limitNum,
        offset: offset
      });

      // Contar total de comentarios para paginación
      const total = await strapi.db.query('api::comment.comment').count({
        where: {
          author: userId
        }
      });

      return ctx.send({
        data: comments,
        meta: {
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: total,
            pageCount: Math.ceil(total / limitNum)
          }
        }
      });

    } catch (error) {
      console.error('Error fetching user comments:', error);
      return ctx.badRequest('Error fetching comments');
    }
  }
}));
