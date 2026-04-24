import { WebSocketServer } from "ws"
import http from "http"

const server = http.createServer()
const wss = new WebSocketServer({ server })

let messages = []
let players = {}

function broadcast(data) {
  const str = JSON.stringify(data)
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(str)
  })
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    let data
    try { data = JSON.parse(msg) } catch { return }

    if (data.type === "chat") {
      const m = {
        id: Date.now() + Math.random(),
        username: data.username,
        message: data.message,
        timestamp: new Date().toISOString()
      }

      messages.unshift(m)
      if (messages.length > 100) messages.pop()

      broadcast({ type: "chat", data: m })
    }

    if (data.type === "game") {
      players[data.username] = {
        username: data.username,
        x: data.x,
        y: data.y,
        angle: data.angle,
        color: data.color,
        lastSeen: Date.now()
      }

      broadcast({ type: "game", data: players[data.username] })
    }
  })

  ws.send(JSON.stringify({
    type: "init",
    messages,
    players: Object.values(players)
  }))
})

setInterval(() => {
  const now = Date.now()
  for (const [name, p] of Object.entries(players)) {
    if (now - p.lastSeen > 5000) delete players[name]
  }
}, 2000)

const PORT = process.env.PORT || 3000
server.listen(PORT)
