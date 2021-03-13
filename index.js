const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const moment = require('moment');
const { connected } = require('process');
const PORT = process.env.PORT || 5000;

// const {
//   userJoin,
//   getCurrentUser,
//   userLeave,
//   getEventUsers
// } = require('./users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

events = new Map();
membersockets = new Map();

// Set static folder
app.use(express.static('public'));
app.use('/socketio', express.static('node_modules/socket.io/client-dist/'));

// Start server on defined port
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

function getEvent(eventid) {
  return events.get(eventid);
}

function getEventUsers(eventid) {
  return getEvent(eventid).users;
}

function getEventUser(eventid, userid) {
  let users = getEventUsers(eventid);
  let user = users.get(userid);
  return user;
}

function getAppointmentsForUser(eventid, userid) {
  // console.log(getEvent(eventid))
  let apps = getEvent(eventid).appointments;
  let userApps = [];
  if (app != null); {
    apps.forEach((app) => {
      if (app.sender.id == userid || app.recipient.id == userid) {
        userApps.push(app);
      }
    })
  }
  return userApps;
}

function getActiveAppointmentForUser(eventid, userid) {
  let now = moment();
  let apps = getAppointmentsForUser(eventid, userid);
  for (var i = 0; i < apps.length; i++) {
    let app = apps[i];
    let timeEnd = moment(app.time, 'DD/MM/YYYY HH:mm').add(4, 'minutes').add(30, 'seconds');

    if (now.isBefore(timeEnd) && now.isAfter(app.time)) {
      console.log(app);
      return app;
    }
  }
  return null;
}

function userLeftEvent(eventid, userid) {
  let user = getEventUser(eventid, userid);
  user.resetSocketId();
}

function checkUserAllowed(eventid, userid) {
  let allowed = getEvent(eventid).userAllowed(userid);
  return allowed;
}

function checkUserConnected(eventid, userid) {
  let connected = getEvent(eventid).userConnected(userid);
  return connected;
}

function checkEventExists(eventid) {
  return events.has(eventid);
}

function addUserToEvent(eventid, user, socketid) {
  membersockets.set(socketid, { eventid, user });
  events.get(eventid).addUserToEvent(user, socketid);
  // console.log(getEventUsers(eventid));
}

function userLeave(socketid) {
  if (membersockets.has(socketid)) {
    let event = membersockets.get(socketid).eventid;
    let user = membersockets.get(socketid).user

    userLeftEvent(event, user.id);

    console.log('removed from membersockets. Event: ' + event + ' User: ' + user.id);

    return [event, user];
  }
  return null
}

// Run when client connects
io.on('connection', socket => {
  console.log('user joined: ' + socket.id);

  socket.on('join-event', ({ user, event }) => {

    if (!checkEventExists(event)) {
      // console.log('event does not exist')
      // console.log('asking for event')
      socket.emit('send-event');
    } else {
      if (checkUserAllowed(event, user.id)) {
        if (!checkUserConnected(event, user.id)) {
          addUserToEvent(event, user, socket.id);
          console.log('added user: (' + user.id + ') ' + user.name + ' ' + socket.id + ' to event');
        }
      } else {
        console.log('User not allowed to join (' + user.id + ') ' + user.name);
        socket.disconnect();
        // console.log(getEventUsers(event));
      }
    }

    socket.on('send-event', (json) => {
      if (!events.has(json.event)) {

        event = new Event(json, socket.id);
        console.log(event);

        events.set(json.event, event);

        addUserToEvent(json.event, getEventUser(json.event, json.user.id), socket.id);

        console.log('New Event ' + json.event + ' Added')
      } else {
        socket.emit('message', 'Event Already Exists')
      }
    });

    // const user = userJoin(socket.id, user, event);

    socket.join(event.id);

    // Welcome current user
    socket.emit('message', 'Welcome. The Event With Begin Shortly!');

    // Broadcast when a user connects
    socket.broadcast
      .to(event.id)
      .emit(
        'message',
        `${user.name} has joined the event`
      );

    // Send users and event info
    io.to(event.id).emit('event-users', {
      event: event.id,
      users: event.users
    });
  });

  socket.on('get-appointment-current', (json) => {
    console.log('user requested active appointment')
    if (events.has(json.event)) {
      let app = getActiveAppointmentForUser(json.event, json.user)
      console.log(app);
      socket.emit('send-appointment', app);
    } else {
      socket.emit('send-event');
    }
    // if (apps.size > 0) {
    //   socket.emit('send-active-appointment')
    // } else {
    //   socket.emit('message', 'No Active Call')
    // }
  });


  // Listen for chatMessage (Not Needed)
  // socket.on('chatMessage', msg => {
  //   const user = getCurrentUser(socket.id);
  //
  //   io.to(user.event).emit('message', formatMessage(user.user, msg));
  // });


  // Runs when client disconnects
  socket.on('disconnect', () => {

    const arr = userLeave(socket.id);
    if (arr != null) {
      const eventid = arr[0];
      const user = arr[1];

      if (user) {
        io.to(eventid).emit(
          'message',
          `${user.name} has left the Event`
        );

        // Send users and event info
        io.to(eventid).emit('event-users', {
          event: eventid,
          users: getEventUsers(eventid)
        });
      }
    }
  });
});

class User {
  id;
  name;
  socketid;

  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  setSocketId(socketid) {
    this.socketid = socketid;
  }

  resetSocketId() {
    this.socketid = null;
  }
}

class Appointment {
  id;
  time;
  sender;
  recipient;
  constructor(id, time, sender, recipient) {
    this.id = id;
    this.time = moment(time, 'DD/MM/YYYY HH:mm');
    this.sender = sender;
    this.recipient = recipient;
  };
}

class Event {
  appointments = new Map();
  users = new Map();

  constructor(json, socketid) {
    json.users.forEach((user) => {
      let uTemp = new User(user.id, user.name);
      this.addUserToMap(uTemp);
    });

    this.setUserSocketId(json.user.id, socketid);

    json.appointments.forEach((item) => {
      let sender = this.users.get(item.sender.id);
      let recipient = this.users.get(item.recipient.id);
      var app = new Appointment(item.id, item.time, sender, recipient)
      this.addAppointmentToMap(app);
    });
  }

  addAppointmentToMap(appointment) {
    this.appointments.set(appointment.id, appointment);
  }

  removeAppointmentFromMap(key) {
    this.appointments.delete(key);
  }

  getUserFromThisEvent(userid) {
    return this.users.get(userid);
  }

  removeUserFromEvent(user) {
    // call class method that removes the user from the map of users
    let userTemp = this.removeUserFromMap(user.id);
    //return the user
    return userTemp;
  }

  addUserToEvent(user, socketid) {
    console.log('addusertoevent: ' + user.id + ', ' + socketid);
    // create a new user
    let userTemp = this.getUserFromThisEvent(user.id);
    // set the user's socketid
    userTemp.setSocketId(socketid);
    console.log(userTemp);
    // add the new user to the map of users using class method
    this.addUserToMap(userTemp);
  }

  addUserToMap(user) {
    // add a user model to the users map with the its id as the key
    this.users.set(user.id, user);
  }

  removeUserFromMap(key) {
    // get the user to be deleted
    let user = this.users.get(key);
    // delete the user
    this.users.delete(key);
    // return a copy of the user
    return user;
  }

  setUserSocketId(userid, socketid) {
    //get the connected user
    let user = this.users.get(userid);
    // set the socketid of the new user
    user.socketid = socketid;
  }

  userAllowed(userid) {
    // check user is a part of the event list
    let isAllowed = this.users.has(userid);
    //test user is a part of the event and they are not connected
    return isAllowed;
  }

  userConnected(userid) {
    // check the user is connected (has a socketid)
    let isConnected = this.users.get(userid).socketid != null ? true : false;
    return isConnected;
  }
}
