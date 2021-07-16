class User {
    id;
    name;
    active;

    constructor(id, name) {
        this.id = id;
        this.name = name;
    }

    setActive() {
        this.active = true;
        this.active ? true : false;
    }

    setInactive() {
        this.active = false;
        !this.active ? true : false;
    }
}

module.exports = User;