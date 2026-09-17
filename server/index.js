import express from "express"
import { Server } from "socket.io"
import mongoose from "mongoose"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

import Message from "./models/message.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"

const app = express()

app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

const io = new Server(expressServer)

const UserState = {
  users: [],

  setUsers: function (newUsersArray) {
    this.users = newUsersArray
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected")
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error)
  })

io.on("connection", (socket) => {

  console.log(`User ${socket.id} connected`)

  socket.emit(
    "message",
    buildMsg(
      ADMIN,
      "Welcome to the chat application!"
    )
  )

  socket.on("enterRoom", async ({ name, room }) => {

    const prevRoom = getUser(socket.id)?.room

    if (prevRoom) {

      socket.leave(prevRoom)

      io.to(prevRoom).emit(
        "message",
        buildMsg(
          ADMIN,
          `${name} has left the room`
        )
      )

      io.to(prevRoom).emit("userList", {
        users: getUsersInRoom(prevRoom)
      })
    }

    const user = activateUser(
      socket.id,
      name,
      room
    )

    socket.join(user.room)

    socket.emit(
      "message",
      buildMsg(
        ADMIN,
        `You have joined the ${user.room} chat room`
      )
    )

    const messages = await Message.find({
      room: user.room
    })
      .sort({ createdAt: 1 })
      .limit(50)

    socket.emit("messageHistory", messages)

    io.to(user.room).emit("userList", {
      users: getUsersInRoom(user.room)
    })

    io.emit("roomsList", {
      rooms: getAllActiveRooms()
    })
  })

  socket.on("message", async ({ name, text }) => {

    const user = getUser(socket.id)

    if (!user) {
      return
    }

    const message = await Message.create({
      name,
      text,
      room: user.room
    })

    io.to(user.room).emit(
      "message",
      buildMsg(name, text)
    )

    io.to(user.room).emit(
      "savedMessage",
      message
    )
  })

  socket.on("activity", (name) => {

    const room = getUser(socket.id)?.room

    if (room) {
      socket.broadcast
        .to(room)
        .emit("activity", name)
    }
  })

  socket.on("disconnect", () => {

    const user = getUser(socket.id)

    userLeavesApp(socket.id)

    if (user) {

      io.to(user.room).emit(
        "message",
        buildMsg(
          ADMIN,
          `${user.name} has left the room`
        )
      )

      io.to(user.room).emit("userList", {
        users: getUsersInRoom(user.room)
      })

      io.emit("roomsList", {
        rooms: getAllActiveRooms()
      })
    }

    console.log(
      `User ${socket.id} disconnected`
    )
  })
})

function buildMsg(name, text) {

  return {
    name,
    text,
    time: new Intl.DateTimeFormat(
      "default",
      {
        hour: "numeric",
        minute: "numeric",
        second: "numeric"
      }
    ).format(new Date())
  }
}

function activateUser(id, name, room) {

  const user = {
    id,
    name,
    room
  }

  UserState.setUsers([
    ...UserState.users.filter(
      user => user.id !== id
    ),
    user
  ])

  return user
}

function userLeavesApp(id) {

  UserState.setUsers(
    UserState.users.filter(
      user => user.id !== id
    )
  )
}

function getUser(id) {

  return UserState.users.find(
    user => user.id === id
  )
}

function getUsersInRoom(room) {

  return UserState.users.filter(
    user => user.room === room
  )
}

function getAllActiveRooms() {

  return Array.from(
    new Set(
      UserState.users.map(
        user => user.room
      )
    )
  )
}