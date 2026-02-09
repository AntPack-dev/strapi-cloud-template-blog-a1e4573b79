module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/likes/:id/toggle-like',
      handler: 'like.toggleLike',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
