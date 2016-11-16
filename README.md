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
  console.log(msg.content)
  done(null, 'reply')
})
.landing('test_channel', 'key2', function(msg, done) {
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
//No Routing Key
.launch('message', function(err, res) {
  if (err) throw new Error(err)
  console.log(res.content)
  res.finish()
})
```
