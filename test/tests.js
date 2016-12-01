const chai = require('chai')
const mockery = require('mockery')
const nsqjs = require('./mocks/nsqjs_mock')

mockery.registerMock('nsqjs', nsqjs)
mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
})

const Rocket = require('./../rocket')

function newIstance() {
    return Rocket({
        serviceId: 'service_id',
        loggerLevel: 'silent',
        writer: {},
        reader: {}
    })
}

describe('NsqRocket', function() {
    describe('new istance', function() {
        it('should instanciate a new NsqRocket instance', function() {
            chai.expect(newIstance()).to.be.an.instanceof(Rocket)
        })

        it('should raise an error if options missing', function() {
            chai.expect(() => {
                Rocket()
            }).to.throw(Error)
        })

        it('should response to methods: topic, landing, launch, default', function() {
            const rocket = newIstance()

            chai.expect(rocket).to.respondTo('topic')
            chai.expect(rocket).to.respondTo('landing')
            chai.expect(rocket).to.respondTo('launch')
            chai.expect(rocket).to.respondTo('default')
        })
    })
})

describe('Message exchange', function() {
    beforeEach(function() {
        nsqjs.reset()
    });

    describe('cb scopes', function() {
        it('should cb scope be instanceof reader', function(tested) {
            const rocket = newIstance()

            rocket
            .topic('test')
            .landing('channel', function(msg, done) {
                chai.expect(this).to.be.an.instanceof(nsqjs.Reader)
                tested()
            })
            .launch('message')
        })
    })

    describe('send and recive message', function() {
        it('should recive message', function(tested) {
            newIstance()
            .topic('test')
            .landing('channel', function(msg, done) {
                chai.expect(msg.content).to.equal('message')
                tested()
            })
            .launch('message')
        })

        it('should recive message with string pattern', function(tested) {
            newIstance()
            .topic('test')
            .landing('channel', 'key', function(msg, done) {
                chai.expect(msg.content).to.equal('message')
                tested()
            })
            .launch('message', 'key')
        })

        it('should recive message with object pattern', function(tested) {
            newIstance()
            .topic('test')
            .landing('channel', {key: 'test'}, function(msg, done) {
                chai.expect(msg.content).to.equal('message')
                tested()
            })
            .launch('message', {key: 'test'})
        })

        it('should recive message with auto channel', function(tested) {
            newIstance()
            .topic('test')
            .landing(function(msg, done) {
                chai.expect(msg.content).to.equal('message')
                tested()
            })
            .launch('message')
        })

        it('should recive message to default cb', function(tested) {
            newIstance()
            .topic('def')
            .landing(function(msg, done) {})
            .default(function(msg, done) {
                tested()
            })
            .launch('message', 'no_key')
        })
    })

    describe('send, recive and reply', function() {
        it('should reply to message', function(tested) {
            newIstance()
            .topic('test')
            .landing('channel', function(msg, done) {
                done(null, 'reply')
            })
            .launch('message', function(err, msg) {
                chai.expect(msg.content).to.equal('reply')
                tested()
            })
        })

        it('should reply with error', function(tested) {
            newIstance()
            .topic('test')
            .landing('channel', function(msg, done) {
                done('error', null)
            })
            .launch('message', function(err, msg) {
                chai.expect(err).to.equal('error')
                tested()
            })
        })
    })
})
