const bloomrun = require('bloomrun')

function Writer(host, port, opts) {
    if (!(this instanceof Writer)) {
        return new Writer(host, port, opts)
    }
}

Writer.prototype.connect = function() {}

Writer.prototype.publish = function(topic, msg, err_cb) {
    const iterator = Writer.readers.iterator({topic: topic})
    let cb = null

    msg = {
        attempts: 1,
        body: Buffer.from(JSON.stringify(msg)),
        json: function () {
            return JSON.parse(this.body)
        },
        finish: function() {},
        requeue: function(delay, backoff) {}
    }

    while (cb = iterator.next()) {
        cb(msg)
    }
}

Writer.readers = bloomrun()

Writer.READY = 'ready'
Writer.CLOSED = 'closed'
Writer.ERROR = 'error'

Writer.prototype.on = function(event, cb) {
    if (event == 'ready') cb()
    return this
}

function Reader(topic, channel, opts) {
    if (!(this instanceof Reader)) {
        return new Reader(host, port, opts)
    }

    this.topic = topic
}

Reader.prototype.connect = function() {}

Reader.MESSAGE = 'message'
Reader.DISCARD = 'discard'
Reader.ERROR = 'error'
Reader.NSQD_CONNECTED = 'nsqd_connected'
Reader.NSQD_CLOSED = 'nsqd_closed'

Reader.prototype.on = function(event, cb) {
    if (event == 'message') {
        Writer.readers.add({topic: this.topic}, cb)
    }
    return this
}

module.exports = {
    Writer: Writer,
    Reader: Reader,
    reset: function() {
        Writer.readers = bloomrun()
    }
}
