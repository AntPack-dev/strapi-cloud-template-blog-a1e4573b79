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
        defaultList = await strapi.db.query('api::favorite-list.favorite-list').create({
          data: {
            name: 'favorites',
            description: 'My favorite articles',
            isDefault: true,
            user: { id: userId }
          },
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
            connect: [articleId]
          }
        },
        populate: ['articles']
      });

      return ctx.send({
        data: updatedList,
        message: 'Article added to favorites'
      });
    } catch (error) {
      console.error('Error adding article to favorites:', error);
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
            disconnect: [articleId]
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
          user: { id: userId }
        },
        populate: {
          articles: {
            select: ['id', 'title', 'slug', 'description', 'imageCard']
          }
        },
        orderBy: { isDefault: 'desc', createdAt: 'desc' }
      });

      return ctx.send({
        data: lists
      });
    } catch (error) {
      console.error('Error getting user favorite lists:', error);
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
      const newList = await strapi.db.query('api::favorite-list.favorite-list').create({
        data: {
          name,
          description: description || '',
          isDefault: false,
          user: { id: userId }
        },
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
