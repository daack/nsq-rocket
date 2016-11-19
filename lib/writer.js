const nsqjs = require('nsqjs')
const bloomrun = require('bloomrun')

function RocketWriter(options) {
    if (!(this instanceof RocketWriter)) {
        return new RocketWriter(options)
    }

    this.listeners = bloomrun()
    this.options = options
    this.started = false
    this.waitings = []

    this.nsqWriter = this.initWriter()
}

RocketWriter.prototype.initWriter = function () {
    const writer = new nsqjs.Writer(this.options.host, this.options.port, this.options.options)

    writer.connect()

    writer
    .on(nsqjs.Writer.READY, () => {
        this.started = true
        this.emit(this, 'ready')
        this.waitings.forEach((cb) => {
            cb.call(this)
        })
    })
    .on(nsqjs.Writer.CLOSED, () => { this.emit(writer, 'closed') })
    .on(nsqjs.Writer.ERROR, (err) => { this.emit(writer, 'error', err) })

    return writer
}

RocketWriter.prototype.publish = function(topic, msg, cbError) {
    if (!this.started) {
        this.waitings.push(() => {
            this.publish(topic, msg, cbError);
        })
        return false
    }

    this.nsqWriter.publish(topic, msg, function(err) {
        if (cbError) cbError.call(this)
    })
    return true
}

RocketWriter.prototype.emit = function(scope, event, data) {
    const iterator = this.listeners.iterator(event)
    let cb = null

    while (cb = iterator.next()) {
        cb.call(scope, data)
    }
}

RocketWriter.prototype.on = function(event, cb) {
    this.listeners.add(event, cb)
}

module.exports = RocketWriter
