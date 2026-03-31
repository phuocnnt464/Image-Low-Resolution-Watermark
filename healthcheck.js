#!/usr/bin/env node
/**
 * Kiểm tra toàn bộ luồng routes: server trực tiếp + qua Vite proxy
 *
 * Chạy:
 *   node healthcheck.js                         # local mặc định
 *   node healthcheck.js --server http://localhost:3000 --client http://localhost:80
 *   node healthcheck.js --server http://server:3000   --client http://client:5173
 *   node healthcheck.js --server https://convert.1creators.com --client https://convert.1creators.com
 */

const http  = require('http')
const https = require('https')

// ── Parse args ────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2)
const getArg     = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null }
const SERVER_BASE = getArg('--server') || 'http://localhost:3000'
const CLIENT_BASE = getArg('--client') || 'http://localhost:5173'
const TIMEOUT     = 6000

// ── Màu ───────────────────────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
}

// ── HTTP fetch ────────────────────────────────────────────────────────────────
function fetch(url, method = 'GET') {
  return new Promise((resolve) => {
    const start  = Date.now()
    const lib    = url.startsWith('https') ? https : http
    const parsed = new URL(url)

    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (url.startsWith('https') ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      timeout:  TIMEOUT,
      headers:  { 'User-Agent': 'healthcheck/1.0' },
    }, (res) => {
      let raw = ''
      res.on('data', (d) => raw += d)
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(raw) } catch {}
        resolve({ status: res.statusCode, ms: Date.now() - start, raw, json, error: null })
      })
    })

    req.on('timeout', () => { req.destroy(); resolve({ status: 0, ms: TIMEOUT, raw: '', json: null, error: 'TIMEOUT' }) })
    req.on('error',   (e) => resolve({ status: 0, ms: Date.now() - start, raw: '', json: null, error: e.code || e.message }))
    req.end()
  })
}

// ── In 1 dòng kết quả ─────────────────────────────────────────────────────────
function row(label, url, res, expectStatus) {
  const ok      = !res.error && res.status === expectStatus
  const icon    = ok ? c.green('✅') : c.red('❌')
  const code    = res.error
    ? c.red(res.error.padEnd(12))
    : ok
      ? c.green(String(res.status).padEnd(12))
      : c.red(`${res.status}≠${expectStatus}`.padEnd(12))
  const ms      = res.ms > 1000 ? c.red(`${res.ms}ms`) : res.ms > 300 ? c.yellow(`${res.ms}ms`) : c.green(`${res.ms}ms`)
  const preview = res.error
    ? c.red(res.error)
    : res.json !== null
      ? c.dim(JSON.stringify(res.json).slice(0, 70))
      : c.dim(`(binary ${res.raw.length}B)`)

  console.log(`  ${icon}  ${code}  ${ms.padEnd(18)}  ${label.padEnd(42)}  ${preview}`)
  return ok
}

// ── Nhóm check ────────────────────────────────────────────────────────────────
async function section(title, checks) {
  console.log()
  console.log(c.bold(`── ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}`))
  let pass = 0, fail = 0
  for (const [label, url, method, expect] of checks) {
    const res = await fetch(url, method)
    row(label, url, res, expect) ? pass++ : fail++
  }
  return { pass, fail }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log()
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(c.bold('  HEALTHCHECK — Kiểm tra luồng Client ↔ Server'))
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(c.cyan(`  SERVER direct : ${SERVER_BASE}`))
  console.log(c.cyan(`  CLIENT proxy  : ${CLIENT_BASE}`))
  console.log(c.dim('  (pass: 2xx/404 đúng với expect | fail: sai status hoặc lỗi kết nối)'))

  let totalPass = 0, totalFail = 0

  const add = ({ pass, fail }) => { totalPass += pass; totalFail += fail }

  // ── 1. Server trực tiếp ───────────────────────────────────────────────────
  add(await section('SERVER trực tiếp (gọi thẳng :3000)', [
    ['GET  /health',                `${SERVER_BASE}/health`,                'GET',  200],
    ['GET  /assets/watermark.png',  `${SERVER_BASE}/assets/watermark.png`,  'GET',  200],
    ['GET  /route-không-tồn-tại → 404 JSON', `${SERVER_BASE}/xyz-not-found`, 'GET', 404],
  ]))

  // ── 2. Qua Vite proxy (client → server) ──────────────────────────────────
  add(await section('QUA PROXY Vite (:80 → :3000) — luồng thực tế', [
    ['GET  /assets/watermark.png',  `${CLIENT_BASE}/assets/watermark.png`,  'GET',  200],
    ['GET  / (Vite HTML)',          `${CLIENT_BASE}/`,                      'GET',  200],
  ]))

  // ── 3. Chẩn đoán proxy ────────────────────────────────────────────────────
  console.log()
  console.log(c.bold('── CHẨN ĐOÁN PROXY ─────────────────────────────────────────'))

  const directAPI   = await fetch(`${SERVER_BASE}/api/images/history`)
  const proxyAPI    = await fetch(`${CLIENT_BASE}/api/images/history`)
  const directAsset = await fetch(`${SERVER_BASE}/assets/watermark.png`)
  const proxyAsset  = await fetch(`${CLIENT_BASE}/assets/watermark.png`)

  const diagnose = (label, direct, proxy) => {
    if (direct.error && proxy.error) {
      console.log(c.red(`  ❌ ${label}: Cả server lẫn proxy đều không kết nối được → server container chưa chạy`))
    } else if (!direct.error && direct.status === 200 && proxy.error) {
      console.log(c.red(`  ❌ ${label}: Server OK nhưng proxy FAIL → vite.config.js target sai (dùng localhost thay vì tên service Docker)`))
    } else if (!direct.error && direct.status === 200 && proxy.status !== 200) {
      console.log(c.yellow(`  ⚠️  ${label}: Server OK (${direct.status}) nhưng proxy trả ${proxy.status} → route chưa được proxy`))
    } else if (direct.status === 200 && proxy.status === 200) {
      console.log(c.green(`  ✅ ${label}: Server OK + Proxy OK → luồng thông suốt`))
    } else {
      console.log(c.red(`  ❌ ${label}: Server ${direct.status || direct.error} | Proxy ${proxy.status || proxy.error}`))
    }
  }

  diagnose('/api/images/*', directAPI,   proxyAPI)
  diagnose('/assets/*',     directAsset, proxyAsset)

  // ── Tổng kết ──────────────────────────────────────────────────────────────
  console.log()
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log(
    `  KẾT QUẢ: ${c.green(`✅ ${totalPass} passed`)}  ${totalFail > 0 ? c.red(`❌ ${totalFail} failed`) : c.dim('❌ 0 failed')}`
  )
  if (totalFail > 0) {
    console.log()
    console.log(c.yellow('  💡 Gợi ý debug:'))
    console.log(c.dim('     docker logs server        # xem lỗi phía server'))
    console.log(c.dim('     docker logs client        # xem lỗi Vite proxy'))
    console.log(c.dim('     docker exec -it client sh # vào container client kiểm tra kết nối'))
    console.log(c.dim('     curl http://server:3000/health  # test từ trong container client'))
  }
  console.log(c.bold('═══════════════════════════════════════════════════════════'))
  console.log()

  process.exit(totalFail > 0 ? 1 : 0)
}

run().catch((e) => { console.error(c.red('Crashed:'), e); process.exit(1) })