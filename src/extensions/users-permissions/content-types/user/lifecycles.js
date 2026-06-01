module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    
    // Si no se proporciona username, generarlo a partir del email
    if (!data.username && data.email) {
      data.username = data.email.split('@')[0];
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;
    
    // Si no se proporciona username pero hay email, generarlo
    if (!data.username && data.email) {
      data.username = data.email.split('@')[0];
    }
  }
};
