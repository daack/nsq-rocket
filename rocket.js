const nsqjs = require('nsqjs')
const uuid = require('node-uuid')

function NsqRocket(opts) {
    if (!opts.serviceId) throw new Error('serviceId missing')

    if (!(this instanceof NsqRocket)) {
        return new NsqRocket(opts)
    }

    this.options = opts
    this.reader = new RocketReader(this, opts.reader)
    this.writer = new RocketWriter(opts.writer)
}

NsqRocket.prototype.topic = function(topic) {
    this.currentTopic = topic
    return this
}

NsqRocket.prototype.landing = function(channel, routingKey, cb) {
    if (typeof routingKey == 'function') {
        cb = routingKey
        routingKey = null
    }

    if (typeof channel == 'function') {
        cb = channel
        routingKey = null
        channel = uuid.v4()
    }

    this
    .reader
    .setNsqReader(this.currentTopic, channel)
    .add(routingKey, cb)

    return this
}

NsqRocket.prototype.default = function(cb) {
    this.reader.addDefault(this.currentTopic, cb)
    return this
}

NsqRocket.prototype.launch = function(message, routingKey, cb) {
    let current_topic = this.currentTopic

    if (typeof routingKey == 'function') {
        cb = routingKey
        routingKey = null
    }

    const replyKey = uuid.v4()
    const _this = this

    this.writer.on('ready', function() {
        const msg = {
            message: message,
            routingKey: routingKey
        }

        if (cb) {
            _this.addReplierReaderKey(replyKey, cb)

            msg['replyTo']  = _this.options.serviceId
            msg['replyKey'] = replyKey
        }

        this.publish(current_topic, msg)
    })

    return this
}

NsqRocket.prototype.addReplierReaderKey = function(replyKey, cb) {
    this
    .reader
    .setNsqReader(this.options.serviceId, 'replier')
    .add(replyKey, function(msg, done) {
        cb.call(this, msg.headers.error, msg)
    }, true)
}

function RocketReader(rocket, options) {
    if (!options) throw new Error('Reader options missing')

    this.store = new Store()
    this.defaultStore = new Store()
    this.rocket = rocket
    this.options = options
    this.onces = []
}

RocketReader.prototype.setNsqReader = function(topic, channel) {
    const key = topic + channel
    let readerStore = this.store.get(key)

    if (!readerStore) {
        const reader = new nsqjs.Reader(topic, channel, this.options)

        readerStore = new Store()

        reader.connect()
        reader.on(nsqjs.Reader.MESSAGE, this.nsqMessage(reader, readerStore))
        reader.on(nsqjs.Reader.DISCARD, this.nsqMessageDiscard(reader, readerStore))
        reader.on(nsqjs.Reader.ERROR, this.nsqError)
        reader.on(nsqjs.Reader.NSQD_CONNECTED, this.nsqdConnected)
        reader.on(nsqjs.Reader.NSQD_CLOSED, this.nsqdClosed)

        this.store.set(key, readerStore)
    }
    this.readerStore = readerStore

    return this
}

RocketReader.prototype.add = function(routingKey, cb, once = false) {
    if (once) this.onces.push(routingKey)
    this.readerStore.set(routingKey, cb)
}

RocketReader.prototype.addDefault = function(topic, cb) {
    this.defaultStore.set(topic, cb)
}

RocketReader.prototype.callMessage = function(cb, reader, msg) {
    const _this = this
    cb.call(reader, msg, replierFor(msg))

    function replierFor(msg) {
        return (err, message) => {
            if (err) {
                msg.requeue()
            } else {
                msg.finish()
            }

            if (msg.headers.replyTo && msg.headers.replyKey) {
                _this.rocket.writer.on('ready', function() {
                    this.publish(msg.headers.replyTo, {
                        message: message,
                        routingKey: msg.headers.replyKey,
                        error: err
                    })
                })
            }
        }
    }
}

RocketReader.prototype.nsqMessage = function(reader, store) {
    let routingKey = null
    let cb = null

    return (msg) => {
        msg = formatMessage(msg)

        if ((cb = store.get(msg.headers.routingKey)) || (cb = this.defaultStore.get(reader.topic))) {
            this.callMessage(cb, reader, msg)

            if (index = this.onces.indexOf(msg.headers.routingKey)) {
                store.del(msg.headers.routingKey)
                this.onces.splice(index, 1)
            }
            return
        }

        //TODO: add to parameters
        (msg.attempts > 5) ? msg.finish() : msg.requeue()
    }
}

RocketReader.prototype.nsqMessageDiscard = function(reader, store) {
    return (msg) => {
        //TODO
    }
}

RocketReader.prototype.nsqdConnected = function(host, port) {
    //TODO
}

RocketReader.prototype.nsqdClosed = function(host, port) {
    //TODO
}

RocketReader.prototype.nsqError = function(err) {
    //TODO
}

function RocketWriter(options) {
    if (!options) throw new Error('Writer options missing')

    this.store = new Store()
    this.events = []

    this.options = options
    this.nsqWriter = this.startNsqWriter()
}

RocketWriter.prototype.startNsqWriter = function () {
    const writer = new nsqjs.Writer(this.options.host, this.options.port, this.options.options)

    writer.connect()

    writer.on(nsqjs.Writer.READY, () => {
        this.emit('ready')
    })

    return writer
}

RocketWriter.prototype.publish = function(topic, msg) {
    this.nsqWriter.publish(topic, msg, (err) => {
        //TODO
    })
}

RocketWriter.prototype.emit = function(event) {
    this.events.push(event)
    const s_event = this.store.get(event)
    if (!s_event) return
    s_event.forEach((cb) => { cb.call(this) })
}

RocketWriter.prototype.on = function(event, cb) {
    if (this.events.indexOf(event) != -1) cb.call(this)
    let s_event = this.store.get(event)
    if (!s_event) s_event = []
    s_event.push(cb)

    this.store.set(event, s_event)
}

function formatMessage(msg) {
    msg.headers = {}

    try {
        const body = msg.json()

        msg.headers = {
            routingKey: body.routingKey,
            replyTo: body.replyTo,
            replyKey: body.replyKey,
            error: body.error
        }

        msg.content = body.message
    } catch (err) {
        //
    }

    return msg
}

//Store

function Store() {
    this.db = {}
}

Store.prototype.set = function(key, value) {
    this.db[key] = value
}

Store.prototype.has = function(key) {
    return this.db.hasOwnProperty(key)
}

Store.prototype.get = function(key, def = null) {
    return this.has(key) ? this.db[key] : def
}

Store.prototype.del = function(key) {
    delete this.db[key]
}

module.exports = NsqRocket
