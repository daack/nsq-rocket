# NSQ Rocket :rocket:

```javascript
var Rocket = require('nsq-rocket');

var rocket = Rocket({
  serviceId: 'id',
  writer: {
    host: '127.0.0.1',
    port: 4150
  },
  reader: {
    lookupdHTTPAddresses: '127.0.0.1:4161'
  }
});

rocket
.topic('sample_topic')
.landing('test_channel', 'key', function(msg, done) {
  console.log(msg.body.toString())
  done(null, 'risposta')
})
.launch('message', 'key', (res) => {
  console.log(res.body.toString())
  res.finish()
})
```
