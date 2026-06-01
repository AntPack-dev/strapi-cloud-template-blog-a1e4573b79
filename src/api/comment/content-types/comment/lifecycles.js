module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    
    if (event.state && event.state.user) {
      data.author = event.state.user.id;
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;
    
    if (event.state && event.state.user && !data.author) {
      data.author = event.state.user.id;
    }
  }
};
