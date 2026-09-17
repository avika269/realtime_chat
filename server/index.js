import express from "express"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

import { connectDB, User, Message } from "./database.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const JWT_SECRET = process.env.JWT_SECRET || "secretkey"

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`)
})

const io = new Server(expressServer, {
  cors: {
    origin: "*"
  }
})

const onlineUsers = new Map()


connectDB()


app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      })
    }

    const existingUser = await User.findOne({
      $or: [
        { username: username },
        { email: email }
      ]
    })

    if (existingUser) {
      return res.status(400).json({
        message: "Username or email already exists"
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      username,
      email,
      password: hashedPassword
    })

    res.status(201).json({
      message: "Registration successful",
      userId: user._id,
      username: user.username
    })

  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Registration failed"
    })
  }
})


app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      })
    }

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    )

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    )

    res.json({
      message: "Login successful",
      token,
      userId: user._id.toString(),
      username: user.username
    })

  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Login failed"
    })
  }
})


io.on("connection", (socket) => {

  console.log("User connected:", socket.id)


  socket.on("userLogin", (userData) => {

    const username = userData.username

    onlineUsers.set(socket.id, {
      socketId: socket.id,
      username
    })

    console.log(`${username} joined with socket ${socket.id}`)

    sendOnlineUsers()
  })


  socket.on("userLogout", () => {

    removeUser(socket.id)

    console.log("User logged out:", socket.id)

    sendOnlineUsers()
  })


  socket.on("chatMessage", async (data) => {

    try {

      const { username, message } = data

      if (!username || !message) {
        return
      }

      const newMessage = await Message.create({
        username,
        message
      })

      io.emit("message", {
        id: newMessage._id,
        username: newMessage.username,
        message: newMessage.message,
        createdAt: newMessage.createdAt
      })

    } catch (error) {

      console.log("Message error:", error)

    }

  })


  socket.on("callUser", (data) => {

    const { to, from, username, offer } = data

    if (!to) {
      return
    }

    io.to(to).emit("incomingCall", {
      from,
      username,
      offer
    })

  })


  socket.on("callAccepted", (data) => {

    const { to, answer } = data

    if (!to) {
      return
    }

    io.to(to).emit("callAccepted", {
      answer
    })

  })


  socket.on("iceCandidate", (data) => {

    const { candidate, to } = data

    if (!to || !candidate) {
      return
    }

    io.to(to).emit("iceCandidate", {
      candidate
    })

  })


  socket.on("callRejected", (data) => {

    const { to } = data

    if (!to) {
      return
    }

    io.to(to).emit("callRejected")

  })


  socket.on("endCall", (data) => {

    const { to } = data

    if (!to) {
      return
    }

    io.to(to).emit("endCall")

  })


  socket.on("disconnect", () => {

    const user = onlineUsers.get(socket.id)

    if (user) {
      console.log(`${user.username} disconnected`)
    }

    removeUser(socket.id)

    sendOnlineUsers()

  })

})


function removeUser(socketId) {
  onlineUsers.delete(socketId)
}


function sendOnlineUsers() {

  const users = Array.from(onlineUsers.values()).map((user) => {

    return {
      id: user.socketId,
      username: user.username
    }

  })

  io.emit("users", users)
}