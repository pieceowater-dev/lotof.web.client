import { WebSocket } from 'ws'
import { toWsUrl } from '@/utils/api-base'

type ServerSideWebSocket = WebSocket & {
  setSocket: (socket: any, head: Buffer, maxPayload: number) => void;
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const req = event.node.req
    const socket = event.node.req.socket

    const namespaceSlug = String(query.namespace || '')
    const postId = String(query.postId || '')
    const method = String(query.method || 'METHOD_QR')
    const secret = String(query.secret || '')
    const interval = query.interval ? String(query.interval) : undefined

    if (!namespaceSlug || !postId || !secret) {
      throw createError({ statusCode: 400, statusMessage: 'Missing namespace, postId, or secret' })
    }

    // Check if this is a WebSocket upgrade request
    if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
      throw createError({ statusCode: 426, statusMessage: 'Upgrade Required' })
    }

    const atraceGatewayUrl = process.env.ATRACE_GATEWAY_URL || 'http://127.0.0.1:8081'

    const gatewayWsUrl = toWsUrl(atraceGatewayUrl, '/api/v1/atrace/qr/stream', {
      namespace: namespaceSlug,
      postId,
      method,
      secret,
      interval,
    })

    console.log('[WS Proxy] Creating WebSocket connection to:', gatewayWsUrl)

    // Create WebSocket connection to backend
    const backendWs = new WebSocket(gatewayWsUrl)

    // Create WebSocket server for client
    const clientWs = new WebSocket(null as any) as ServerSideWebSocket
    clientWs.setSocket(socket as any, Buffer.alloc(0), 100 * 1024 * 1024)

    // Pipe messages from backend to client
    backendWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data)
      }
    })

    // Pipe messages from client to backend
    clientWs.on('message', (data) => {
      if (backendWs.readyState === WebSocket.OPEN) {
        backendWs.send(data)
      }
    })

    // Handle backend errors
    backendWs.on('error', (err) => {
      console.error('[WS Proxy] Backend error:', err.message)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, 'Backend error')
      }
    })

    // Handle backend close
    backendWs.on('close', () => {
      console.log('[WS Proxy] Backend closed')
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close()
      }
    })

    // Handle client errors
    clientWs.on('error', (err) => {
      console.error('[WS Proxy] Client error:', err.message)
      if (backendWs.readyState === WebSocket.OPEN) {
        backendWs.close()
      }
    })

    // Handle client close
    clientWs.on('close', () => {
      console.log('[WS Proxy] Client closed')
      if (backendWs.readyState === WebSocket.OPEN) {
        backendWs.close()
      }
    })

    // Prevent Nuxt from sending response
    return new Promise<void>(() => {})
  } catch (err: any) {
    console.error('[WS Proxy] Error:', err.message, err.stack)
    throw err
  }
})
