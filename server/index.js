import express from "express"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"
const app = express()

app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

const UserState = {
  users: [],
  setUsers: function (newUsersArray) {
    this.users = newUsersArray
  }
}

const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:5500", "http://127.0.0.1:5500"]
  }
})

io.on("connection", socket => {

  console.log(`User ${socket.id} connected`)

  socket.emit(
    "message",
    buildMsg(ADMIN, "Welcome to the chat app!")
  )

  socket.on("enterRoom", ({ name, room }) => {

    const prevRoom = getUser(socket.id)?.room

    if (prevRoom) {
      socket.leave(prevRoom)

      io.to(prevRoom).emit(
        "message",
        buildMsg(ADMIN, `${name} has left the room`)
      )
    }

    const user = activateUser(socket.id, name, room)

    if (prevRoom) {
      io.to(prevRoom).emit("userList", {
        users: getUsersInRoom(prevRoom)
      })
    }

    socket.join(user.room)

    socket.emit(
      "message",
      buildMsg(
        ADMIN,
        `You have joined the ${user.room} chat room`
      )
    )

    io.to(user.room).emit("userList", {
      users: getUsersInRoom(user.room)
    })

    io.emit("roomsList", {
      rooms: getAllActiveRooms()
    })
  })

  socket.on("disconnect", () => {

    const user = getUser(socket.id)

    userLeavesApp(socket.id)

    if (user) {

      io.to(user.room).emit(
        "message",
        buildMsg(ADMIN, `${user.name} has left the room`)
      )

      io.to(user.room).emit("userList", {
        users: getUsersInRoom(user.room)
      })

      io.emit("roomsList", {
        rooms: getAllActiveRooms()
      })
    }

    console.log(`User ${socket.id} disconnected`)
  })

  socket.broadcast.emit(
    "message",
    `User ${socket.id.substring(0, 5)} connected`
  )

  socket.on("message", ({ name, text }) => {

    const room = getUser(socket.id)?.room

    if (room) {
      io.to(room).emit(
        "message",
        buildMsg(name, text)
      )
    }
  })

  socket.on("activity", name => {

    const room = getUser(socket.id)?.room

    if (room) {
      socket.broadcast.to(room).emit("activity", name)
    }
  })
})

function buildMsg(name, text) {
  return {
    name,
    text,
    time: new Intl.DateTimeFormat("default", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric"
    }).format(new Date())
  }
}

function activateUser(id, name, room) {

  const user = { id, name, room }

  UserState.setUsers([
    ...UserState.users.filter(user => user.id !== id),
    user
  ])

  return user
}

function userLeavesApp(id) {

  UserState.setUsers(
    UserState.users.filter(user => user.id !== id)
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
      UserState.users.map(user => user.room)
    )
  )
}