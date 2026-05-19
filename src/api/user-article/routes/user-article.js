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
      method: 'GET',
      path: '/user-articles/my-articles',
      handler: 'user-article.getMyArticles',
      config: { policies: [], middlewares: [] },
    },
  ],
};
