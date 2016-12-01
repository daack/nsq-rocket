# NSQ Rocket :rocket:

Simple framework to handle request response pattern on nsq.io

* [Install](#install)
* [Example](#example)
* [API](#api)
* [Events](#events)

<a name="install"></a>
## Install

To install nsq-rocket, simply use npm:

```
npm install nsq-rocket --save
```

<a name="example"></a>
## Example

```javascript
var Rocket = require('nsq-rocket');

var rocket = Rocket({
  serviceId: 'id',
  loggerLevel: 'info',
  writer: {
    //nsqjs writer configuration
    host: '127.0.0.1',
    port: 4150
  },
  reader: {
    //nsqjs reader configuration
    lookupdHTTPAddresses: '127.0.0.1:4161'
  }
});

rocket
.topic('sample_topic')
.landing('test_channel', 'key', function(msg, done) {
  console.log(msg.content)
  done(null, 'reply')
})
.landing('test_channel', {pattern: 'object'}, function(msg, done) {
  console.log(msg.content)
  done(null, 'reply')
})
//Default cb for this topic if no key found
.default(function(msg, done) {
  console.log(msg.content)
  done(null, 'reply')
})
.topic('change_topic')
//No key landing
.landing('test_channel', function(msg, done) {
  console.log(msg.content)
  done(null, 'reply')
});

rocket
.topic('sample_topic')
.launch('message', 'key', function(err, res) {
  if (err) throw new Error(err)
  console.log(res.content)
  res.finish()
})
.launch('message', {pattern: 'object'}, function(err, res) {
  if (err) throw new Error(err)
  console.log(res.content)
  res.finish()
})
//No Routing Key
.launch('message', function(err, res) {
  if (err) throw new Error(err)
  console.log(res.content)
  res.finish()
})
```

<a name="api"></a>
## API

  * <a href="#constructor"><code><b>Rocket()</b></code></a>
  * <a href="#topic"><code>instance.<b>topic()</b></code></a>
  * <a href="#landing"><code>instance.<b>landing()</b></code></a>
  * <a href="#launch"><code>instance.<b>launch()</b></code></a>
  * <a href="#default"><code>instance.<b>default()</b></code></a>

-------------------------------------------------------
<a name="constructor"></a>
### Rocket([opts])

Creates a new instance of Rocket.

Options are:

* `serviceId`
* `loggerLevel` ['silent', 'info', 'warn', 'error', 'fatal']
* `reader` (nsqjs reader)
* `writer` (nsqjs writer)

-------------------------------------------------------
<a name="topic"></a>
### instance.topic(topic)

Change the current topic

-------------------------------------------------------
<a name="landing"></a>
### instance.landing([channel, pattern, cb])

Set a new listener for NSQ

* `channel`, you can put your cb here if you want a random channel and no pattern
* `pattern`, you can put your cb here if you want no pattern

-------------------------------------------------------
<a name="launch"></a>
### instance.launch(message,[pattern, cb])

Publish a new message to NSQ

* `pattern`, publish with a specific pattern
* `cb`, if you want listen for reply

-------------------------------------------------------
<a name="default"></a>
### instance.default(cb)

Set a default cb for the current topic

<a name="events"></a>
## Events

  * <a href="#reader"><code><b>reader</b></code></a>
  * <a href="#writer"><code><b>writer</b></code></a>

-------------------------------------------------------
<a name="reader"></a>
### instance.reader.on(event, data)

  * discard -> message
  * error -> error
  * connected -> {host: host, port: port}
  * closed -> {host: host, port: port}
  * replier_error -> error

-------------------------------------------------------
<a name="writer"></a>
### instance.writer.on(event, data)

  * ready
  * closed
  * error -> error
