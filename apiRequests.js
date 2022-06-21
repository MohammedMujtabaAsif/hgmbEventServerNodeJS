
const superagent = require('superagent')


class ApiRequests {
    hostname = 'https://virtualmuzmatch.co.uk/api/';
    // hostname = 'https://d7c2-82-14-70-40.ngrok.io/api/';
    token;
    headers;

    constructor(token) {
        this.token = token;
        this.headers = {
            Accept: 'application/json',
            Authorization: `Bearer ${this.token}`
        };
    }

    getUrl(path) {
        return `${this.hostname}get/${path}`;
    }

    createSuperAgent(path) {
        var url = `${this.hostname}get/${path}`;
        console.log(url);
        return superagent.get(url).set(this.headers);
    }

    async getActiveEvent() {
        var data;
        let url = this.getUrl('events/joined/active');
        console.log('accessing '.url);

        return await superagent.get(url).set(this.headers).then(res => {
            data = res.body;
            console.log('received: ');
            console.log(data);
            return data;
        }).catch(err => {
            this.handleError(err);
        })
    }

    async getUser() {
        var data;
        let url = this.getUrl('account/user');

        return await superagent.get(url).set(this.headers).then(res => {
            data = res.body;
            return data;
        }).catch(err => {
            this.handleError(err);
        })
    }

    handleError(error) {
        console.log(error);
    }
}

module.exports = ApiRequests;
