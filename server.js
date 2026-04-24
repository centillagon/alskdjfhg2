import { WebSocketServer } from "ws"
import http from "http"

const server = http.createServer()
const wss = new WebSocketServer({ server })

let messages = []
let players = {}
let playerLaps = {}
let race = { phase: "idle", winner: null }

function broadcast(data) {
  const str = JSON.stringify(data)
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(str) })
}

function endRace(winner) {
  const idleAt = Date.now() + 40000
  race = { phase: "intermission", winner, idleAt }
  broadcast({ type: "race", data: race })
  setTimeout(() => {
    race = { phase: "idle", winner: null }
    playerLaps = {}
    broadcast({ type: "race", data: race })
  }, 40000)
}

function startRace() {
  const racingAt = Date.now() + 5000
  race = { phase: "countdown", racingAt }
  broadcast({ type: "race", data: race })
  setTimeout(() => {
    playerLaps = {}
    race = { phase: "racing", racingAt: Date.now() }
    broadcast({ type: "race", data: race })
  }, 5000)
}

setInterval(() => {
  if (race.phase !== "idle") return
  if (Object.keys(players).length === 0) return
  startRace()
}, 5 * 60 * 1000)

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

    if (data.type === "lap") {
      if (race.phase !== "racing") return
      const u = data.username
      playerLaps[u] = (playerLaps[u] || 0) + 1
      broadcast({ type: "lapUpdate", data: { username: u, laps: playerLaps[u] } })
      if (playerLaps[u] >= 3) endRace(u)
    }
  })

  ws.send(JSON.stringify({
    type: "init",
    messages,
    players: Object.values(players),
    race,
    laps: playerLaps
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
