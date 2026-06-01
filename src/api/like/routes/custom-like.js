module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/likes/toggle-interaction',
      handler: 'like.toggleInteraction',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/likes/my-interactions',
      handler: 'like.getMyInteractions',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
