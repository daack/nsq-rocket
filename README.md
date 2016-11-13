# NSQ Rocket :rocket:

```javascript
var Rocket = require('nsq-rocket');

var rocket = Rocket({
  serviceId: 'id',
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
  console.log(msg.body.toString())
  done(null, 'reply')
})
.landing('test_channel', 'key2', function(msg, done) {
  console.log(msg.body.toString())
  done(null, 'reply')
})
//Default cb for this topic if no key found
.default(function(msg, done) {
  console.log(msg.body.toString())
  done(null, 'risposta')
})
.topic('change_topic')
//No key landing
.landing('test_channel', function(msg, done) {
  console.log(msg.body.toString())
  done(null, 'reply')
});

rocket
.topic('sample_topic')
.launch('message', 'key', function(res) {
  console.log(res.body.toString())
  res.finish()
})
//No Routing Key
.launch('message', function(res) {
  console.log(res.body.toString())
  res.finish()
})
```
