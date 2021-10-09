const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const moment = require('moment');
const PORT = process.env.PORT || 5000;
const Event = require('./event.js');
const ApiRequests = require('./apiRequests.js');
// Event from 'event.js'

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Set static folder
app.use(express.static('public'));
app.use('/socketio', express.static('node_modules/socket.io/client-dist/'));

// Start server on defined port
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

var events = new Map();
var usersockets = new Map();

wss.on('connection', function connection(ws, req) {

  // A method to send events with a specific type so they can be differentiated by the client
  ws.message = function message(type, data) {
    // console.log('sending message:');
    // console.log(`type: ${type}`);
    // console.log(data);
    var json = JSON.stringify({ type: type, data: data });
    console.log(json);
    ws.send(json);

  }

  let socketid = req.headers['sec-websocket-key'];
  console.log('user connected with socketid: ' + socketid);

  ws.message('connection', 'Welcome to the Event');

  ws.listen = function listen(json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      ws.message('error', 'Message sent in invalid format');
      console.log('Message received in invalid format');
    }
    // console.log(parsed)
    let type = parsed.type;
    let data = parsed.data;
    console.log(type);
    switch (type) {
      case 'join-event':
        console.log('user attempting to join event')
        var token = data.token;
        // console.log(token)
        getApiEvent(token).then((data) => {
          // console.log('data from method: ');
          console.log(data);
          var success = false;
          if (data != null) {

            var eventid = data.id;
            var userid = data.user.id;

            var event = createEvent(data);
            addEventToEventsMap(eventid, event);

            success = joinEvent(eventid, userid, socketid, ws);
          } else {
            ws.message('joined-event-fail', 'No Active Event Found')
          }
          
          if (success) {
            ws.message('joined-event-success', 'Welcome');
            messageActiveUsersOfEvent(eventid, true);
          } else {
            ws.message('joined-event-fail', 'Failed to join event');
            messageActiveUsersOfEvent(eventid, false);
          }
        });
        break;
      case 'leave-event':
        console.log('user leaving event')
        setUserAsLeft(socketid);
        break;
      // case 'get-appointment':
      //   sendCurrentAppointment(data);
      //   break;

      // case 'get-next-appointment':
      //   sendNextAppointment(data);
      //   break;
      // case 'get-event':

      //   break;

      case 'check-connected':
        console.log('user checking they are connected');
        ws.message('connected', true);
        break;
      default:
        console.log("couldn't process message");
        break;
    }
  }

  ws.on('message', function (message) {
    // console.log(message);
    ws.listen(message);
  });

  ws.on('close', function close(code, reason) {
    console.log('user disconnected with code: ' + code + ', reason: ' + reason);
    console.log(socketid);
    let eventid = getUserFromActiveUsersMap(socketid).eventid;
    setUserAsLeft(socketid);
    messageActiveUsersOfEvent(eventid, false);
  });


  function sendCurrentAppointment(data) {
    var eventid = parseInt(data.eventid);
    getApiUser(data.token).then((res) => {
      let userid = res.id;
      console.log(`user ${userid} requested active appointment for event ${eventid}`);
      console.log(`eventid: ${eventid}, socketid: ${socketid}`)
      var appointment = getActiveAppointmentForUser(eventid, socketid);
      ws.message('send-appointment', appointment);
    });
  }


  function sendNextAppointment(data) {
    var eventid = parseInt(data.eventid);
    getApiUser(data.token).then((res) => {
      let userid = res.id;
      console.log(`user ${userid} requested next appointment for event ${eventid}`);
      console.log(`eventid: ${eventid}, socketid: ${socketid}`)
      var appointment = getNextAppointmentForUser(eventid, socketid);
      ws.message('send-next-appointment', appointment);
    });

  }

  function messageActiveUsersOfEvent(eventid, joined) {
    let users = getUsersForEvent(eventid);
    let activeUsers = getActiveUsersIdsForEvent(eventid);
    let s = joined ? 'user-joined' : 'user-left';
    activeUsers.forEach((userid) => {
      let user = users.get(userid);
      if (user.getWS() != null) {
        console.log('found socket');
        user.getWS().message(s, activeUsers);
      }
    });
  }
});


function addUserToActiveUsersMap(socketid, user) {
  usersockets.set(socketid, user);
  console.log('Active Users: ')
  console.log(usersockets);
}

function getUserFromActiveUsersMap(socketid) {
  return usersockets.get(socketid);
}

function removeUserFromActiveUsersMap(socketid) {
  usersockets.delete(socketid);
}


function createEvent(json) {
  let e = getEventFromEventsMap(json['id']);
  if (e == null) {
    e = new Event(json);
  }
  return e;
}

// Add the new events to the map of events with it's id as the key.
function addEventToEventsMap(eventid, event) {
  let size = events.size;
  events.set(eventid, event);

  // return a true value if the event map increased in size by 1
  size + 1 == events.size ? true : false;
}

// retrieve the event with the specified id. if no event exists then return false. 
function getEventFromEventsMap(eventid) {
  console.log(`Event id is ${eventid}`);
  console.log(events);
  let event = events.get(eventid)
  // console.log(this.event);
  if (event != null) {
    console.log(`Event ${eventid} found`);
    return event;
  }
  return null;
}

// retrieve the users for an event with the specified id from the Events map.
function getUsersForEvent(eventid) {
  let users = getEventFromEventsMap(eventid).users;
  if (users != null) {
    console.log(users);
    return users;
  }
  return null;
}

// get a user from an event based upon the event and user id
function getUserFromEvent(eventid, userid) {
  let users = getUsersForEvent(eventid);
  var user;
  if (users) {
    user = users.get(userid);
  }

  if (user != null) {
    return user;
  }
  return null;
}

// 
function setUserAsLeft(socketid) {
  let user = getUserFromActiveUsersMap(socketid);
  user.removeWS();
  removeUserFromActiveUsersMap(socketid);
  console.log(user);
}

// 
function joinEvent(eventid, userid, socketid, websocket) {
  console.log(`${eventid}  ${userid}  ${socketid}`);
  let user = getUserFromEvent(eventid, userid);
  if (user) {
    user.setWS(websocket);
    addUserToActiveUsersMap(socketid, user);
    console.log(`user with ${userid} joined event ${eventid}`);
    console.log(events);
    return true;
  }
  console.log(`user ${userid} not found`)
  return false
}

// retrieve the appointments for an event with the specified id from the Events map.
function getAppointmentsForEvent(eventid) {
  let event = getEventFromEventsMap(eventid);
  let appointments;
  if (event != null) {
    appointments = event.getAppointments();
  } else {
    console.log(`Event ${eventid} not found`);
  }
  return appointments;
}

// 
function getAppointmentsForUser(eventid, socketid) {
  // console.log(getEvent(eventid))
  let apps = getAppointmentsForEvent(eventid);
  console.log(getUserFromActiveUsersMap(socketid));
  let userid = getUserFromActiveUsersMap(socketid).id;
  let userApps = [];
  if (apps != null) {
    console.log('searching appointments');
    apps.forEach((app) => {
      console.log(`checking ${app.id}'s sender (${app.sender.id}) and recipient (${app.recipient.id})`)
      if (app.sender.id == userid || app.recipient.id == userid) {
        userApps.push(app);
      }
    })
  }
  return userApps;
}

// Find the appointment for the user that started less than 4 minutes and 30 seconds ago
function getActiveAppointmentForUser(eventid, socketid) {
  let now = moment();
  let apps = getAppointmentsForUser(eventid, socketid);
  for (var i = 0; i < apps.length; i++) {
    let app = apps[i];
    let timeEnd = moment(app.time, 'DD/MM/YYYY HH:mm').add(4, 'minutes').add(30, 'seconds');

    if (now.isBefore(timeEnd) && now.isAfter(app.time)) {
      console.log('Found active appointment');
      console.log(app);
      return app;
    }
  }
  console.log('No active appointment found')
  return null;
}

// Find the next appointment
function getNextAppointmentForUser(eventid, socketid) {
  let now = moment();
  let apps = getAppointmentsForUser(eventid, socketid);
  for (var i = 0; i < apps.length; i++) {
    let app = apps[i];
    let timeStart = moment(app.time, 'DD/MM/YYYY HH:mm').subtract(5, 'seconds');
    console.log(`App Time: ${timeStart}`);
    console.log(`Now Time: ${now}`)
    if (timeStart.isAfter(now)) {
      console.log('Found next appointment');
      console.log(app);
      return app;
    }
  }
  console.log('No next appointment found')
  return null;
}

function getActiveUsersIdsForEvent(eventid) {
  let event = getEventFromEventsMap(eventid);
  let activeUsers = [];
  event.users.forEach((user) => {
    if (user.isActive()) {
      activeUsers.push(user.id);
      console.log(user.isActive());
    }
  });
  return activeUsers;
}



async function getApiEvent(token) {
  console.log('getting active event from api request');
  var api = new ApiRequests(token);
  var eventData = await api.getActiveEvent().then((data => {
    console.log('response received');
    if (!data['success']) {
      console.log(data['message']);
      return null;
    } else {
      return data['data'];
    }
  }));
  console.log('event data received');
  // console.log(eventData);
  return eventData;
}

async function getApiUser(token) {
  console.log(`getting user's ID from api request`);
  var api = new ApiRequests(token);
  var user = await api.getUser().then(data => {
    console.log('response received');
    if (!data['success']) {
      console.log(data['message']);
      return null;
    } else {
      return data['data'];
    }
  });
  console.log('user data received');
  // console.log(eventData);
  return user;

}