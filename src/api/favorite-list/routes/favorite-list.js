'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/favorite-lists/default',
      handler: 'favorite-list.createOrGetDefault',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'POST',
      path: '/favorite-lists/add-article',
      handler: 'favorite-list.addArticle',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'POST',
      path: '/favorite-lists/remove-article',
      handler: 'favorite-list.removeArticle',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'GET',
      path: '/favorite-lists/my-lists',
      handler: 'favorite-list.getUserLists',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'GET',
      path: '/favorite-lists/check/:articleId',
      handler: 'favorite-list.checkArticleFavorite',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'POST',
      path: '/favorite-lists',
      handler: 'favorite-list.create',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    }
  ]
};
