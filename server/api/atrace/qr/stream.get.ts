import http from 'http'

export default defineEventHandler(async (event) => {
  try {
    console.log('[SSE] Handler called:', event.node.req.url)
    const query = getQuery(event)

    const namespaceSlug = String(query.namespace || '')
    const postId = String(query.postId || '')
    const method = String(query.method || 'METHOD_QR')
    const secret = String(query.secret || '')
    const intervalSec = Math.max(5, parseInt(String(query.interval || '15')) || 15)

    if (!namespaceSlug || !postId || !secret) {
      console.log('[SSE] Missing required params')
      throw createError({ statusCode: 400, statusMessage: 'Missing namespace, postId, or secret' })
    }

    const res = event.node.res
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.writeHead(200)
    res.write(': proxy connected\n\n')
    res.flushHeaders?.()

    const atraceGatewayUrlRaw = process.env.VITE_API_ATRACE || 'http://127.0.0.1:8081'
    const atraceGatewayUrl = atraceGatewayUrlRaw.replace('http://localhost', 'http://127.0.0.1')
    const gatewayUrl = `${atraceGatewayUrl}/api/v1/atrace/qr/stream?namespace=${encodeURIComponent(namespaceSlug)}&postId=${encodeURIComponent(postId)}&method=${encodeURIComponent(method)}&secret=${encodeURIComponent(secret)}&interval=${intervalSec}`

    console.log('[SSE] Connecting to gateway:', atraceGatewayUrl)

    return new Promise<void>((resolve) => {
      const req = http.get(gatewayUrl, {
        headers: {
          Accept: 'text/event-stream',
          Connection: 'keep-alive',
        },
        agent: new http.Agent({ keepAlive: true }),
      }, (res2) => {
        console.log('[SSE] Gateway response:', res2.statusCode)
        if (res2.statusCode === 200) {
          res2.on('data', (chunk) => {
            res.write(chunk)
            res.flushHeaders?.()
          })
          res2.on('end', () => {
            res.end()
            resolve()
          })
          res2.on('error', (err) => {
            console.error('[SSE] Stream error:', err.message)
            res.end()
            resolve()
          })
        } else {
          console.log('[SSE] Bad gateway status:', res2.statusCode)
          res.end()
          resolve()
        }
      }).on('error', (err) => {
        console.error('[SSE] Connection error:', err.message)
        res.end()
        resolve()
      })
    })
  } catch (err: any) {
    console.error('[SSE] Catch error:', err.message, err.stack)
    throw err
  }
})
