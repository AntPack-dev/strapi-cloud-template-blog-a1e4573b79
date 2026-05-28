'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/user-articles/create-article',
      handler: 'user-article.createArticle',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/user-articles/:documentId',
      handler: 'user-article.updateArticle',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/user-articles/:documentId/submit',
      handler: 'user-article.submitForReview',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/user-articles/:documentId/withdraw',
      handler: 'user-article.withdrawFromReview',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/user-articles/:documentId',
      handler: 'user-article.deleteArticle',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/user-articles/my-articles',
      handler: 'user-article.getMyArticles',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/user-articles/:documentId',
      handler: 'user-article.getMyArticle',
      config: { policies: [], middlewares: [] },
    },
  ],
};
