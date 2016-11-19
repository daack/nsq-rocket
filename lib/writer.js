const nsqjs = require('nsqjs')
const bloomrun = require('bloomrun')

function RocketWriter(options) {
    if (!(this instanceof RocketWriter)) {
        return new RocketWriter(options)
    }

    this.listeners = bloomrun()
    this.options = options
    this.events = []

    this.nsqWriter = this.initWriter()
}

RocketWriter.prototype.initWriter = function () {
    const writer = new nsqjs.Writer(this.options.host, this.options.port, this.options.options)

    writer.connect()

    writer
    .on(nsqjs.Writer.READY, () => { this.emit(this, 'ready') })
    .on(nsqjs.Writer.CLOSED, () => { this.emit(writer, 'closed') })
    .on(nsqjs.Writer.ERROR, (err) => { this.emit(writer, 'error', err) })

    return writer
}

RocketWriter.prototype.publish = function(topic, msg, cbError) {
    this.nsqWriter.publish(topic, msg, function(err) {
        if (cbError) cbError.call(this)
    })
}

RocketWriter.prototype.emit = function(scope, event, data) {
    const iterator = this.listeners.iterator(event)
    let cb = null

    while (cb = iterator.next()) {
        cb.call(scope, data)
    }

    this.events[event] = {scope: scope, data: data}
}

RocketWriter.prototype.on = function(event, cb) {
    let eventFired = null

    if (eventFired = this.events[event]) {
        return cb.call(eventFired.scope, eventFired.data)
    }

    this.listeners.add(event, cb)
}

module.exports = RocketWriter
