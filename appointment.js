const moment = require('moment');

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

module.exports = Appointment;