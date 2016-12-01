const uuid = require('uuid')

const reader = require('./lib/reader')
const writer = require('./lib/writer')
const logger = require('./lib/logger')

function NsqRocket(opts) {
    if (!opts.serviceId) throw new Error('serviceId missing')

    if (!(this instanceof NsqRocket)) {
        return new NsqRocket(opts)
    }

    logger.setLevel(opts.loggerLevel || 'info')

    opts.writer['clientId'] = opts.writer['clientId'] || opts.serviceId
    opts.reader['clientId'] = opts.reader['clientId'] || opts.serviceId

    this.options = opts
    this.writer = writer(opts.writer)
    this.reader = reader(this.writer, opts.reader)
}

NsqRocket.prototype.topic = function(topic) {
    this.currentTopic = topic

    return this
}

NsqRocket.prototype.landing = function(channel, pattern, cb) {
    if (typeof pattern == 'string') {
        pattern = pattern ? { string_key: pattern } : { empty: true }
    }

    if (typeof pattern == 'function') {
        cb = pattern
        pattern = { empty: true }
    }

    if (typeof channel == 'function') {
        cb = channel
        pattern = { empty: true }
        channel = uuid.v4()
    }

    this
    .reader
    .setReaderStore(this.currentTopic, channel)
    .add(pattern, cb)

    return this
}

NsqRocket.prototype.default = function(cb) {
    this.reader.addDefault(this.currentTopic, cb)

    return this
}

NsqRocket.prototype.launch = function(message, pattern, cb) {
    if (!pattern) {
        pattern = { empty: true }
    }
    else if (typeof pattern == 'function') {
        cb = pattern
        pattern = { empty: true }
    }
    else if (typeof pattern == 'string') {
        pattern = { string_key: pattern }
    }

    const msg = {}

    msg['message'] = message
    msg['routingKey'] = JSON.stringify(pattern)

    if (cb) {
        const replyKey = { string_key: uuid.v4() }

        this.addReplierCb(replyKey, cb)

        msg['replyTo']  = this.options.serviceId
        msg['replyKey'] = JSON.stringify(replyKey)
    }

    this
    .writer
    .publish(this.currentTopic, msg, function(err) {
        if (err && cb) cb.call(this, err)
    })

    return this
}

NsqRocket.prototype.addReplierCb = function(replyKey, cb) {
    this
    .reader
    .setReaderStore(this.options.serviceId, 'replier', true)
    .add(replyKey, function(msg, done) {
        cb.call(this, msg.headers.error, msg)
    })
}

module.exports = NsqRocket
