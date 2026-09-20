import express from "express"
import cors from "cors"
import { createServer } from "http"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

import { connectDB } from "./config/db.js"
import authRoutes from "./routes/authroutes.js"
import userRoutes from "./routes/userRoutes.js"
import chatRoutes from "./routes/chatRoutes.js"
import mediaRoutes from "./routes/mediaRoutes.js"
import callRoutes from "./routes/callRoutes.js"
import contactRoutes from "./routes/contactRoutes.js"
import { socketAuth } from "./sockets/socketAuth.js"
import { registerChatSocket } from "./sockets/chatSocket.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
})

app.use(cors())
app.use(express.json({ limit: "10mb" }))
app.use(express.static(path.join(__dirname)))

await connectDB()

app.use("/api", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api", chatRoutes)
app.use("/api/media", mediaRoutes)
app.use("/api/calls", callRoutes)
app.use("/api", contactRoutes)

io.use(socketAuth)
registerChatSocket(io)

app.use((req, res) => {
  res.sendFile(path.join(__dirname,"index.html"))
})

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`)
})