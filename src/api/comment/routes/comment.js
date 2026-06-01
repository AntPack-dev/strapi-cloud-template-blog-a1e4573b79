'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/comments',
      handler: 'comment.create',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'PUT',
      path: '/comments/:id',
      handler: 'comment.update',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'DELETE',
      path: '/comments/:id',
      handler: 'comment.delete',
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
      path: '/comments/article/:articleId',
      handler: 'comment.getCommentsByArticle',
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
      path: '/comments/my-comments',
      handler: 'comment.getMyComments',
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
