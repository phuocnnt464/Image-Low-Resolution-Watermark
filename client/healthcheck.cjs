/**
 * Docker HEALTHCHECK script cho client container
 */
const http = require('http')

const options = {
  hostname: 'localhost',
  port:     5173,
  path:     '/',
  method:   'GET',
  timeout:  3000,
}

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log(`✅ Client healthy (${res.statusCode})`)
    process.exit(0)
  } else {
    console.error(`❌ Client unhealthy (${res.statusCode})`)
    process.exit(1)
  }
})

req.on('timeout', () => {
  console.error('❌ Client healthcheck timeout')
  req.destroy()
  process.exit(1)
})

req.on('error', (err) => {
  console.error('❌ Client healthcheck error:', err.code || err.message)
  process.exit(1)
})

req.end()