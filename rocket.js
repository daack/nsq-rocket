const uuid = require('node-uuid')

const reader = require('./lib/reader')
const writer = require('./lib/writer')

function NsqRocket(opts) {
    if (!opts.serviceId) throw new Error('serviceId missing')

    if (!(this instanceof NsqRocket)) {
        return new NsqRocket(opts)
    }

    this.options = opts
    this.writer = writer(opts.writer)
    this.reader = reader(this.writer, opts.reader)
}

NsqRocket.prototype.topic = function(topic) {
    this.currentTopic = topic

    return this
}

NsqRocket.prototype.landing = function(channel, pattern, cb) {
    if (typeof pattern == 'function') {
        cb = pattern
        pattern = null
    }

    if (typeof channel == 'function') {
        cb = channel
        pattern = null
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
    if (typeof pattern == 'function') {
        cb = pattern
        pattern = null
    }

    const replyKey = uuid.v4()
    const _this = this

    this.writer.on('ready', function() {
        const msg = {}

        msg['message'] = message

        if (typeof pattern == 'object') {
            msg['routingKey'] = JSON.stringify(pattern)
        } else {
            msg['routingKey'] = pattern
        }

        if (cb) {
            _this.addReplierCb(replyKey, cb)

            msg['replyTo']  = _this.options.serviceId
            msg['replyKey'] = replyKey
        }

        this.publish(_this.currentTopic, msg, function(err) {
            if (err && cb) cb.call(this, err)
        })
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
