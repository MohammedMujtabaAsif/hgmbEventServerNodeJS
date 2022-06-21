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
// app.use(express.static('public'));
// app.use('/socketio', express.static('node_modules/socket.io/client-dist/'));

// Start server on defined port
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

var events = new Map();
var usersockets = new Map();

wss.on('connection', function connection(ws, req) {

  // A method to send events with a specific type so they can be differentiated by the client
  ws.message = function message(type, data) {
    var json = JSON.stringify({ type: type, data: data });
    console.log(json);
    ws.send(json);

  }

  let socketid = req.headers['sec-websocket-key'];
  console.log('user connected with socketid: ' + socketid);

  ws.message('connection', 'Welcome to the Event');

  // Handle requests received from the clients
  ws.listen = function listen(json) {
    let parsed;

    // Parse the request from the client
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      // If the message was not sent as json then notify the client
      ws.message('error', 'Message sent in invalid format');
      console.log('Message received in invalid format');
    }
    // Split the data from the JSON message
    let type = parsed.type;
    let data = parsed.data;

    // Trigger events based upon the type key in the json message
    switch (type) {

      // When a user joins the event
      case 'join-event':

        // Log to the console that a user attempted to join
        console.log('user attempting to join event')

        // Pull the api token from the data sent
        var token = data.token;

        // Request the event information from the api
        getApiEvent(token).then((data) => {
          // Set success to be false by default
          var success = false;

          // If the api responded with data
          if (data != null) {
            // Split the json key data
            var eventid = data.id;
            var userid = data.user.id;


            // Create a new event object
            var event = createEvent(data);
            // Add the event object to the list of events being tracked
            addEventToEventsMap(eventid, event);

            // Attempt the set the user as an active participant in the event
            // If successful, overwrite the success variable above
            success = joinEvent(eventid, userid, socketid, ws);
          } else {
            // If no data is received, send a fail message to the client
            ws.message('joined-event-fail', 'No Active Event Found')
          }

          // If the user successfully joined the event
          if (success) {
            // Notify the client device that they joined the event
            ws.message('joined-event-success', 'Welcome to the event');
            // Notify the other users of the event that a new user has joined
            messageActiveUsersOfEvent(eventid, true);
          } else {
            // Notify the client device that they failed to join the event
            ws.message('joined-event-fail', 'Failed to join event');
            // Notify the other clients that the user is no longer in the event, in case there was a desync
            messageActiveUsersOfEvent(eventid, false);
          }
        });
        break;

      // When a user leaves the event through in app actions
      case 'leave-event':
        console.log('user leaving event')
        // Remove from the active users map and unset their websocket id
        // Handled by setUserAsLeft(socketid)
        setUserAsLeft(socketid);
        break;

      // When a user pings the server to ensure they are connected
      case 'check-connected':
        console.log('user checking they are connected');
        // Response with a positive connected response message
        ws.message('connected', true);
        break;

      // Wehn the type isn't matched with an event above
      default:
        // Alert the client device that the request could not be handled
        ws.message('error', 'Request type not supported');

        // Print an alert to the console showing the type variable
        console.log("couldn't process message:");
        console.log(type);
        break;
    }
  }

  // Listen for requests from clients
  ws.on('message', function (message) {
    // Send the received data to the handler method
    ws.listen(message);
  });

  // When a user disconnects from the websocket
  ws.on('close', function close(code, reason) {
    console.log('user disconnected with code: ' + code + ', reason: ' + reason);
    console.log(socketid);

    // Find the eventid of the user that left
    let eventid = getUserFromActiveUsersMap(socketid).eventid;

    // Remove the user from the list of active users
    setUserAsLeft(socketid);

    // Notify all other users that they have left
    messageActiveUsersOfEvent(eventid, false);
  });

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

// Create and return a new event from the json data provided
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

  // Return a true value if the event map increased in size by 1
  size + 1 == events.size ? true : false;
}

// Retrieve the event with the specified id. if no event exists then return false. 
function getEventFromEventsMap(eventid) {
  console.log(`Event id is ${eventid}`);
  console.log(events);
  let event = events.get(eventid)
  if (event != null) {
    console.log(`Event ${eventid} found`);
    return event;
  }
  return null;
}

// Retrieve the users for an event with the specified id from the Events map.
function getUsersForEvent(eventid) {
  let users = getEventFromEventsMap(eventid).users;
  if (users != null) {
    console.log(users);
    return users;
  }
  return null;
}

// Get a user from an event based upon the event and user id
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

// Remove the ws id from the user model to set them as inactive
// Remove user from the active users map
function setUserAsLeft(socketid) {
  let user = getUserFromActiveUsersMap(socketid);
  user.removeWS();
  removeUserFromActiveUsersMap(socketid);
  console.log(user);
}

// Add the user to the event they are joining
// Set the user's websocket id
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

// Retrieve the appointments for an event with the specified id from the Events map.
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

// Collect all the active user's ids for a specific event
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

// Make an API request for the active user's event data
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
  return eventData;
}