module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/article-ratings',
      handler: 'article-rating.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/article-ratings/check',
      handler: 'article-rating.check',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
