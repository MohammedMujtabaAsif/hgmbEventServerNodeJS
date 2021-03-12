const users = [];

// Join user to chat
function userJoin(id, username, event) {
  const user = { id, username, event };

  users.push(user);

  return user;
}

// Get current user
function getCurrentUser(id) {
  return users.find(user => user.id === id);
}

// User leaves chat
function userLeave(id) {
  const index = users.findIndex(user => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

// Get event users
function getEventUsers(event) {
  return users.filter(user => user.event === event);
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  getEventUsers
};
