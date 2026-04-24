import { WebSocketServer } from "ws"
import http from "http"

const server = http.createServer()
const wss = new WebSocketServer({ server })

let players = {}
let ready = new Set()

function broadcast(data) {
  const s = JSON.stringify(data)
  wss.clients.forEach(c => c.readyState === 1 && c.send(s))
}

function checkStart() {
  const names = Object.keys(players)
  if (names.length > 0 && names.every(n => ready.has(n))) {
    ready.clear()
    broadcast({ type: "raceStart" })
  }
}

wss.on("connection", ws => {

  ws.on("message", msg => {
    let data
    try { data = JSON.parse(msg) } catch { return }

    if (data.type === "ready") {
      if (data.ready) ready.add(data.username)
      else ready.delete(data.username)
      checkStart()
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

  ws.send(JSON.stringify({ type: "game", data: players }))
})

setInterval(() => {
  const now = Date.now()
  for (const [k,v] of Object.entries(players)) {
    if (now - v.lastSeen > 5000) {
      delete players[k]
      ready.delete(k)
    }
  }
}, 2000)

server.listen(process.env.PORT || 3000)
