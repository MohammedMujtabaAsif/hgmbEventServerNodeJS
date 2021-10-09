class User {
    id;
    name;
    eventid;

    constructor(id, name, eventid) {
        this.id = id;
        this.name = name;
        this.setEventId(eventid)

        var ws;

        this.setWS = function (webs) {
            ws = webs;
        }

        this.removeWS = function () {
            ws = null;
        }

        this.getWS = function () {
            return ws;
        }
    }


    isActive() {
        return this.getWS() == null ? false : true;
    }

    setEventId(eventid) {
        this.eventid = eventid;
    }

    removeEventId() {
        this.eventid = null;
    }

}

module.exports = User;