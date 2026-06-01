module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    
    if (event.state && event.state.user) {
      data.user = event.state.user.id;
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;
    
    if (event.state && event.state.user && !data.user) {
      data.user = event.state.user.id;
    }
  }
};
