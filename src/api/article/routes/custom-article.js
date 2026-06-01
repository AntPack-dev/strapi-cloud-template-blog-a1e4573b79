module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/articles/:id/toggle-like',
      handler: 'article.toggleLike',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/articles/with-likes-count',
      handler: 'article.findWithLikesCount',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/articles/:id/with-likes-count',
      handler: 'article.findOneWithLikesCount',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
