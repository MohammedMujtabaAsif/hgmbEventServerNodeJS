const User = require('./user.js');

class Event {
    id = new Number();
    users = new Map();

    constructor(json) {
        console.log('creating event');

        console.log(json.id);
        this.id = json.id;
        // create a map of all users registered for this event
        json.users.forEach((user) => {
            // create a new user with infomation in json
            let u = new User(user.id, user.display_name, this.id);

            // call method to handle adding user to map
            this.addUserToMap(u);
        });

        // set the user as active
        this.setUserAsActive(json.user.id);
        console.log('event created');
    }

    addAppointmentToMap(appointment) {
        this.appointments.set(appointment.id, appointment);
    }

    removeAppointmentFromMap(key) {
        this.appointments.delete(key);
    }

    getAppointments() {
        return this.appointments;
    }

    getUserFromEvent(userid) {
        return this.users.get(userid);
    }

    removeUserFromEvent(user) {
        // call class method that removes the user from the map of users
        let userTemp = this.removeUserFromMap(user.id);
        //return the user
        return userTemp;
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

    getUsers() {
        return this.users;
    }

    addUserToEvent(userid, websocket) {
        console.log('adding user to event: ' + userid + ', ' + socketid);

        // set user as active
        let success = this.setUserAsActive(userid, websocket);

        // log the user's details
        console.log(userTemp);
        if (success) {
            // add the new user to the map of users using class method
            this.addUserToMap(userTemp);
            return true;
        } else {
            return false;
        }

    }

    setUserAsActive(userid, websocket) {
        let user = this.getUserFromEvent(userid);
        if (user != null) {
            user.setWS(websocket);
        }

        if (user.isActive()) {
            return true;
        }
        else {
            return false;
        }
    }

    setUserAsInactive() {
        let user = this.getUserFromEvent(userid);
        if (user != null) {
            user.removeWS();
        }

        if (!user.active) {
            return true;
        }
        else {
            return false;
        }
    }

    userAllowed(userid) {
        // check user is a part of the event
        return this.users.has(userid);
    }

    userConnected(userid) {
        // check the user is connected (has a socketid)
        return this.users.get(userid).socketid != null ? true : false;
    }
}

module.exports = Event;