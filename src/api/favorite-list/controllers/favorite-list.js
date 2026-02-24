'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::favorite-list.favorite-list', ({ strapi }) => ({
  // Crear o obtener lista por defecto del usuario
  async createOrGetDefault(ctx) {
    const { user } = ctx.state;
    const userId = user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      // Buscar si ya existe una lista por defecto
      let defaultList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
        where: {
          user: { id: userId },
          isDefault: true
        },
        populate: ['articles']
      });

      // Si no existe, crearla
      if (!defaultList) {
        // Generar document_id único
        const crypto = require('crypto');
        const documentId = crypto.randomBytes(13).toString('base64url').substring(0, 25);

        // Crear la lista con SQL raw
        const result = await strapi.db.connection.raw(`
          INSERT INTO favorite_lists (document_id, name, description, is_default, published_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())
          RETURNING id
        `, [documentId, 'favorites', 'My favorite articles', true]);

        const listId = result.rows[0].id;

        // Insertar relación de usuario directamente en tabla de links
        await strapi.db.connection.raw(`
          INSERT INTO favorite_lists_user_lnk (favorite_list_id, user_id)
          VALUES (?, ?)
        `, [listId, userId]);

        // Obtener la lista creada
        defaultList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
          where: { id: listId },
          populate: ['articles']
        });
      }

      return ctx.send({
        data: defaultList
      });
    } catch (error) {
      console.error('Error creating/getting default favorite list:', error);
      return ctx.badRequest('Error processing favorite list');
    }
  },

  // Añadir artículo a lista de favoritos
  async addArticle(ctx) {
    const { user } = ctx.state;
    const { articleId, listId } = ctx.request.body;
    const userId = user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in');
    }

    if (!articleId) {
      return ctx.badRequest('Article ID is required');
    }

    try {
      // Verificar que el artículo existe
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id: articleId }
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      let targetList;

      // Si se proporciona un listId, usar esa lista
      if (listId) {
        targetList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
          where: {
            id: listId,
            user: { id: userId }
          }
        });

        if (!targetList) {
          return ctx.notFound('Favorite list not found');
        }
      } else {
        // Si no, usar o crear la lista por defecto
        targetList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
          where: {
            user: { id: userId },
            isDefault: true
          }
        });

        if (!targetList) {
          targetList = await strapi.db.query('api::favorite-list.favorite-list').create({
            data: {
              name: 'favorites',
              description: 'My favorite articles',
              isDefault: true,
              user: { id: userId }
            }
          });
        }
      }

      // Verificar si el artículo ya está en la lista
      const existingRelation = await strapi.db.query('api::favorite-list.favorite-list').findOne({
        where: {
          id: targetList.id,
          articles: { id: articleId }
        }
      });

      if (existingRelation) {
        return ctx.badRequest('Article already in favorites');
      }

      // Añadir el artículo a la lista
      const updatedList = await strapi.db.query('api::favorite-list.favorite-list').update({
        where: { id: targetList.id },
        data: {
          articles: {
            connect: [{ id: articleId }]
          }
        },
        populate: ['articles']
      });

      return ctx.send({
        data: updatedList,
        message: 'Article added to favorites'
      });
    } catch (error) {
      return ctx.badRequest('Error adding article to favorites');
    }
  },

  // Remover artículo de lista de favoritos
  async removeArticle(ctx) {
    const { user } = ctx.state;
    const { articleId, listId } = ctx.request.body;
    const userId = user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in');
    }

    if (!articleId || !listId) {
      return ctx.badRequest('Article ID and List ID are required');
    }

    try {
      // Verificar que la lista pertenece al usuario
      const favoriteList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
        where: {
          id: listId,
          user: { id: userId }
        }
      });

      if (!favoriteList) {
        return ctx.notFound('Favorite list not found');
      }

      // Remover el artículo de la lista
      const updatedList = await strapi.db.query('api::favorite-list.favorite-list').update({
        where: { id: listId },
        data: {
          articles: {
            disconnect: [{ id: articleId }]
          }
        },
        populate: ['articles']
      });

      return ctx.send({
        data: updatedList,
        message: 'Article removed from favorites'
      });
    } catch (error) {
      console.error('Error removing article from favorites:', error);
      return ctx.badRequest('Error removing article from favorites');
    }
  },

  // Obtener todas las listas del usuario
  async getUserLists(ctx) {
    const { user } = ctx.state;
    const userId = user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in');
    }

    try {

      const lists = await strapi.db.query('api::favorite-list.favorite-list').findMany({
        where: {
          user: userId
        },
        populate: {
          articles: {
            select: ['id', 'title', 'slug', 'description'],
            populate: ['cover', 'category', 'author']
          }
        },
        orderBy: { isDefault: 'desc', createdAt: 'desc' }
      });

      // Enriquecer cada lista con conteos y estado del usuario
      const enrichedLists = await Promise.all(
        lists.map(async (list) => {
          // Enriquecer cada artículo en la lista
          const enrichedArticles = await Promise.all(
            (list.articles || []).map(async (article) => {
              const articleId = article.id;

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
                ...article,
                stats: {
                  likesCount,
                  commentsCount
                },
                userInteraction: {
                  liked: !!userLike,
                  commented: !!userComment
                }
              };
            })
          );

          return {
            ...list,
            articles: enrichedArticles
          };
        })
      );

      return ctx.send({
        data: enrichedLists,
        meta: {
          total: enrichedLists.length
        }
      });
    } catch (error) {
      console.error('Error getting user favorite lists:', error);
      console.error('Error details:', error.message);
      return ctx.badRequest('Error getting favorite lists');
    }
  },

  // Verificar si un artículo está en favoritos del usuario
  async checkArticleFavorite(ctx) {
    const { user } = ctx.state;
    const { articleId } = ctx.params;
    const userId = user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in');
    }

    if (!articleId) {
      return ctx.badRequest('Article ID is required');
    }

    try {
      const favoriteLists = await strapi.db.query('api::favorite-list.favorite-list').findMany({
        where: {
          user: { id: userId },
          articles: { id: articleId }
        },
        populate: ['articles']
      });

      const isFavorite = favoriteLists.length > 0;
      const lists = favoriteLists.map(list => ({
        id: list.id,
        name: list.name,
        isDefault: list.isDefault
      }));

      return ctx.send({
        data: {
          isFavorite,
          lists
        }
      });
    } catch (error) {
      console.error('Error checking article favorite status:', error);
      return ctx.badRequest('Error checking favorite status');
    }
  },

  // Crear nueva lista de favoritos
  async create(ctx) {
    const { user } = ctx.state;
    const userId = user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in');
    }

    const { name, description } = ctx.request.body;

    if (!name) {
      return ctx.badRequest('List name is required');
    }

    try {
      // Generar document_id único
      const crypto = require('crypto');
      const documentId = crypto.randomBytes(13).toString('base64url').substring(0, 25);

      // Crear la lista con SQL raw
      const result = await strapi.db.connection.raw(`
        INSERT INTO favorite_lists (document_id, name, description, is_default, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())
        RETURNING id
      `, [documentId, name, description || '', false]);

      const listId = result.rows[0].id;

      // Insertar relación de usuario directamente en tabla de links
      await strapi.db.connection.raw(`
        INSERT INTO favorite_lists_user_lnk (favorite_list_id, user_id)
        VALUES (?, ?)
      `, [listId, userId]);

      // Obtener la lista creada
      const newList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
        where: { id: listId },
        populate: ['articles']
      });

      return ctx.send({
        data: newList,
        message: 'Favorite list created successfully'
      });
    } catch (error) {
      console.error('Error creating favorite list:', error);
      return ctx.badRequest('Error creating favorite list');
    }
  }
}));
