import express from "express"
import http from "http"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"
import path from "path"
import { fileURLToPath } from "url"
import { Server } from "socket.io"

import authRoutes from "./routes/authroutes.js"
import userRoutes from "./routes/userRoutes.js"
import chatRoutes from "./routes/chatRoutes.js"
import callRoutes from "./routes/callRoutes.js"
import contactRoutes from "./routes/contactRoutes.js"
import mediaRoutes from "./routes/mediaRoutes.js"
import messageRoutes from "./routes/messageRoutes.js"
import postRoutes from "./routes/postRoutes.js"
import commentRoutes from "./routes/commentRoutes.js"

import socketAuth from "./sockets/socketAuth.js"
import chatSocket from "./sockets/chatSocket.js"

dotenv.config()

const app = express()

const server =
    http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: [
            "GET",
            "POST",
            "PATCH",
            "DELETE"
        ]
    }
})

const __filename =
    fileURLToPath(import.meta.url)

const __dirname =
    path.dirname(__filename)

app.use(
    cors()
)

app.use(
    express.json()
)

app.use(
    express.urlencoded({
        extended: true
    })
)

app.use(
    "/uploads",
    express.static(
        path.join(
            __dirname,
            "uploads"
        )
    )
)

app.use(
    "/auth",
    authRoutes
)

app.use(
    "/users",
    userRoutes
)

app.use(
    "/chats",
    chatRoutes
)

app.use(
    "/calls",
    callRoutes
)

app.use(
    "/contacts",
    contactRoutes
)

app.use(
    "/media",
    mediaRoutes
)

app.use(
    "/messages",
    messageRoutes
)

app.use(
    "/posts",
    postRoutes
)

app.use(
    "/comments",
    commentRoutes
)

app.use(
    express.static(
        path.join(
            __dirname,
            "frontend"
        )
    )
)

app.get(
    "/api/health",
    (req, res) => {
        res.json({
            status: "ok",
            message:
                "Realtime Chat API is running"
        })
    }
)

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "frontend",
                "index.html"
            )
        )
    }
)

io.use(socketAuth)

io.on(
    "connection",
    socket => {
        chatSocket(
            io,
            socket
        )
    }
)

const PORT =
    process.env.PORT || 3500

const MONGO_URI =
    process.env.MONGO_URI

if (!MONGO_URI) {
    console.error(
        "MONGO_URI is missing in .env"
    )
    process.exit(1)
}

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log(
            "MongoDB connected successfully"
        )

        server.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    `Server running on port ${PORT}`
                )
            }
        )
    })
    .catch(error => {
        console.error(
            "MongoDB connection failed:",
            error.message
        )
    })