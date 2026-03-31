module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/article-ratings',
      handler: 'article-rating.create',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/article-ratings/check',
      handler: 'article-rating.check',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
      },
    },
  ],
};
