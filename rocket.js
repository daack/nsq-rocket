const nsqjs = require('nsqjs')
const uuid = require('node-uuid')

function NsqRocket(opts) {
    if (!(this instanceof NsqRocket)) {
        return new NsqRocket(opts)
    }

    this.options = opts
    this.reader = new RocketReader(opts.reader)
    this.writer = new RocketWriter(opts.writer)
}

NsqRocket.prototype.topic = function(topic) {
    this.topic = topic
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

    const _this = this

    this
    .reader
    .setNsqReader(this.topic, channel)
    .add(routingKey, function(msg) {
        cb.call(this, msg, init_replier(msg))
    })

    function init_replier(msg) {
        let topic = null
        let routingKey = null

        try {
            const body = msg.json()
            topic = body.replyTo
            routingKey = body.replyKey
        } catch(err) {
            //
        }

        return (err, message) => {
            if (err) {
                msg.requeue()
            } else {
                msg.finish()
            }

            if (topic && routingKey) {
                _this.launch(message, routingKey, topic)
            }
        }
    }

    return this
}

NsqRocket.prototype.launch = function(message, routingKey, cb) {
    let current_topic = this.topic

    if (typeof routingKey == 'function') {
        cb = routingKey
        routingKey = null
    }

    if (typeof cb == 'string') {
        current_topic = cb
        cb = null
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
    .add(replyKey, cb, true)
}

function RocketReader(options) {
    this.store = new Store()
    this.options = options
    this.onces = []
}

RocketReader.prototype.setNsqReader = function(topic, channel) {
    const key = topic + channel
    let reader_store = this.store.get(key)

    if (!reader_store) {
        const reader = new nsqjs.Reader(topic, channel, this.options)

        reader.connect()

        reader_store = new Store()

        reader.on(nsqjs.Reader.MESSAGE, this.nsqMessage(reader, reader_store))
        reader.on(nsqjs.Reader.DISCARD, this.nsqMessageDiscard(reader, reader_store))
        reader.on(nsqjs.Reader.ERROR, this.nsqError)
        reader.on(nsqjs.Reader.NSQD_CONNECTED, this.nsqdConnected)
        reader.on(nsqjs.Reader.NSQD_CLOSED, this.nsqdClosed)

        this.store.set(key, reader_store)
    }
    this.reader_store = reader_store;

    return this
}

RocketReader.prototype.add = function(routingKey, cb, once = false) {
    if (once) this.onces.push(routingKey)
    this.reader_store.set(routingKey, cb)
}

RocketReader.prototype.nsqMessage = function(reader, store) {
    let routingKey = null
    const _this = this

    return (msg) => {
        try {
            const body = msg.json()
            routingKey = body.routingKey || null
        } catch(err) {
            //
        }

        const cb = store.get(routingKey)

        if (cb) {
            cb.call(reader, msg)

            const index = _this.onces.indexOf(routingKey)
            if (index != -1) {
                store.del(routingKey)
                _this.onces.splice(index, 1);
            }
        } else {
            //TODO: da parametrizzare
            (msg.attempts > 5) ? msg.finish() : msg.requeue()
        }
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
