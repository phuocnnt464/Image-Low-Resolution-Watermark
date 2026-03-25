#!/usr/bin/env node
/**
 * Chạy: node healthcheck.js
 * Hoặc: node healthcheck.js --host https://convert.1creators.com
 */

const http  = require('http')
const https = require('https')

// ── Cấu hình ─────────────────────────────────────────────────────────────��────
const args      = process.argv.slice(2)
const hostFlag  = args.indexOf('--host')
const BASE      = hostFlag !== -1 ? args[hostFlag + 1] : 'http://localhost:3000'
const TIMEOUT   = 5000  // ms

// ── Màu terminal ──────────────────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`
const red    = (s) => `\x1b[31m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const bold   = (s) => `\x1b[1m${s}\x1b[0m`
const dim    = (s) => `\x1b[2m${s}\x1b[0m`

// ── HTTP request ──────────────────────────────────────────────────────────────
function request(url, { method = 'GET', expectStatus = 200 } = {}) {
  return new Promise((resolve) => {
    const start    = Date.now()
    const lib      = url.startsWith('https') ? https : http
    const urlObj   = new URL(url)

    const options = {
      hostname: urlObj.hostname,
      port:     urlObj.port || (url.startsWith('https') ? 443 : 80),
      path:     urlObj.pathname + urlObj.search,
      method,
      timeout:  TIMEOUT,
      headers:  { 'User-Agent': 'healthcheck/1.0' },
    }

    const req = lib.request(options, (res) => {
      const ms   = Date.now() - start
      const ok   = res.statusCode === expectStatus
      let body   = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(body) } catch {}
        resolve({ ok, status: res.statusCode, ms, body, json, error: null })
      })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, status: 0, ms: TIMEOUT, body: '', json: null, error: 'TIMEOUT' })
    })
    req.on('error', (err) => {
      const ms = Date.now() - start
      resolve({ ok: false, status: 0, ms, body: '', json: null, error: err.code || err.message })
    })
    req.end()
  })
}

// ── In kết quả một dòng ───────────────────────────────────────────────────────
function printResult(label, url, result, expectStatus = 200) {
  const status = result.error
    ? red(`ERR:${result.error}`)
    : result.status === expectStatus
      ? green(result.status)
      : red(`${result.status}≠${expectStatus}`)

  const time   = result.ms < 500 ? green(`${result.ms}ms`) : yellow(`${result.ms}ms`)
  const icon   = result.ok ? green('✅') : red('❌')
  const detail = result.error
    ? red(result.error)
    : result.json !== null
      ? dim(JSON.stringify(result.json).slice(0, 60))
      : dim(`(binary ${result.body.length}B)`)

  console.log(`  ${icon}  [${status}] ${label.padEnd(38)} ${time}  ${detail}`)
}

// ── Chạy checks ───────────────────────────────────────────────────────────────
async function run() {
  console.log()
  console.log(bold('══════════════════════════════════════════════════════'))
  console.log(bold('  HEALTHCHECK — Image Watermark App'))
  console.log(bold(`  Target: ${BASE}`))
  console.log(bold('═════════════════════════════════════════��════════════'))

  const checks = [
    // ── Server API ────────────────────────────────────────────────────────────
    {
      section: 'SERVER — API',
      items: [
        { label: 'GET /api/images/history',     url: `${BASE}/api/images/history`,      expectStatus: 200 },
        { label: 'GET /api/videos/history',     url: `${BASE}/api/videos/history`,      expectStatus: 200 },
        { label: 'GET /assets/watermark.png',   url: `${BASE}/assets/watermark.png`,    expectStatus: 200 },
        { label: '404 → JSON (not HTML)',        url: `${BASE}/not-exist-route`,         expectStatus: 404 },
      ],
    },
  ]

  let pass = 0, fail = 0

  for (const group of checks) {
    console.log()
    console.log(bold(`── ${group.section} ${'─'.repeat(45 - group.section.length)}`))
    for (const item of group.items) {
      const result = await request(item.url, { expectStatus: item.expectStatus })
      printResult(item.label, item.url, result, item.expectStatus)
      result.ok ? pass++ : fail++
    }
  }

  // ── Tổng kết ─────────────────────────────────────────────────────────────
  console.log()
  console.log(bold('══════════════════════════════════════════════════════'))
  const summary = `  KẾT QUẢ: ${green(`${pass} passed`)}  ${fail > 0 ? red(`${fail} failed`) : dim('0 failed')}`
  console.log(summary)
  console.log(bold('══════════════════════════════════════════════════════'))
  console.log()

  process.exit(fail > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error(red('Healthcheck crashed:'), err)
  process.exit(1)
})