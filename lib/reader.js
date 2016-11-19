const nsqjs = require('nsqjs')
const bloomrun = require('bloomrun')

function RocketReader(writer, options) {
    if (!(this instanceof RocketReader)) {
        return new RocketReader(writer, options)
    }

    this.store = bloomrun()
    this.defaultStore = bloomrun()
    this.listeners = bloomrun()

    this.writer = writer
    this.options = options
}

RocketReader.prototype.initReader = function(topic, channel, replier, store) {
    const reader = new nsqjs.Reader(topic, channel, this.options)

    reader.connect()

    reader
    .on(nsqjs.Reader.MESSAGE, this.incomingMessage(reader, store, replier))
    .on(nsqjs.Reader.DISCARD, (msg) => { this.emit(reader, 'discard', msg) })
    .on(nsqjs.Reader.ERROR, (err) => { this.emit(reader, 'error', err) })
    .on(nsqjs.Reader.NSQD_CONNECTED, (host, port) => { this.emit(reader, 'connected', {host: host, port: port}) })
    .on(nsqjs.Reader.NSQD_CLOSED, (host, port) => { this.emit(reader, 'closed', {host: host, port: port}) })

    return store
}

RocketReader.prototype.setReaderStore = function(topic, channel, replier = false) {
    const key = {topic: topic, channel: channel}
    let store = this.store.lookup(key)

    if (!store) {
        store = this.initReader(topic, channel, replier, bloomrun())
        this.store.add(key, store)
    }
    return store
}

RocketReader.prototype.addDefault = function(topic, cb) {
    this.defaultStore.add(topic, cb)
}

RocketReader.prototype.setReplierFor = function(msg) {
    return (err, message) => {
        if (err) {
            msg.requeue()
        } else {
            msg.finish()
        }

        if (msg.headers.reply) {
            this
            .writer
            .on('ready', function() {
                this.publish(msg.headers.reply.to, {
                    message: message,
                    routingKey: msg.headers.reply.key,
                    error: err
                })
            })
        }
    }
}

RocketReader.prototype.incomingMessage = function(reader, store, replier) {
    return (msg) => {
        let cb = null
        msg = this.formatMessage(msg)

        if ((cb = store.lookup(msg.headers.pattern)) || (cb = this.defaultStore.lookup(reader.topic))) {
            cb.call(reader, msg, this.setReplierFor(msg))

            if (replier) {
                store.remove(msg.headers.pattern)
                msg.finish()
            }
            return true
        }

        if (replier) {
            this.emit(reader, 'replier_error', new Error('missing replier callback'))
            return msg.finish()
        }

        (msg.attempts > 5) ? msg.finish() : msg.requeue()
    }
}

RocketReader.prototype.formatMessage = function(msg) {
    msg.headers = {}

    try {
        const body = msg.json()

        msg.headers = {
            routingKey: body.routingKey,
            error: body.error
        }

        if (body.replyTo && body.replyKey) {
            msg.headers.reply = {
                to: body.replyTo,
                key: body.replyKey
            }
        }

        msg.headers.pattern = this.setPattern(body.routingKey)
        msg.content = body.message
    } catch (err) {
        //
    }

    return msg
}

RocketReader.prototype.setPattern = function(routingKey) {
    try {
        return JSON.parse(routingKey)
    }
    catch (err) {
        return routingKey
    }
}

RocketReader.prototype.emit = function(scope, event, data) {
    const iterator = this.listeners.iterator(event)
    let cb = null

    while (cb = iterator.next()) {
        cb.call(scope, data)
    }
}

RocketReader.prototype.on = function(event, cb) {
    this.listeners.add(event, cb)
}

module.exports = RocketReader
