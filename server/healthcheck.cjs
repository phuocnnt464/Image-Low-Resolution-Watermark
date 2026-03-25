/**
 * Docker HEALTHCHECK script cho server container
 * Dùng built-in http module, không cần cài thêm package
 */
const http = require('http')

const options = {
  hostname: 'localhost',
  port:     process.env.PORT || 3000,
  path:     '/health',
  method:   'GET',
  timeout:  3000,
}

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log(`✅ Server healthy (${res.statusCode})`)
    process.exit(0)
  } else {
    console.error(`❌ Server unhealthy (${res.statusCode})`)
    process.exit(1)
  }
})

req.on('timeout', () => {
  console.error('❌ Server healthcheck timeout')
  req.destroy()
  process.exit(1)
})

req.on('error', (err) => {
  console.error('❌ Server healthcheck error:', err.code || err.message)
  process.exit(1)
})

req.end()