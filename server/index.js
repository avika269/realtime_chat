import express from "express"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import multer from "multer"

import {
  connectDB,
  User,
  Conversation,
  Message,
  Call,
  Contact,
  createConversation,
  saveMedia,
  getMedia,
  deleteMedia,
  getMediaBucket
} from "./database.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const JWT_SECRET = process.env.JWT_SECRET

const app = express()

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`)
})

const io = new Server(expressServer, {
  cors: {
    origin: "*"
  }
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
})

const onlineUsers = new Map()

await connectDB()

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  )
}

function getTokenFromRequest(req) {
  const authorization = req.headers.authorization

  if (!authorization) {
    return null
  }

  if (!authorization.startsWith("Bearer ")) {
    return null
  }

  return authorization.split(" ")[1]
}

async function authenticate(req, res, next) {
  try {
    const token = getTokenFromRequest(req)

    if (!token) {
      return res.status(401).json({
        message: "Authentication required"
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    const user = await User.findById(decoded.userId)

    if (!user) {
      return res.status(401).json({
        message: "User not found"
      })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token"
    })
  }
}

app.post("/api/register", async (req, res) => {
  try {
    const username = req.body.username?.trim()
    const email = req.body.email?.trim().toLowerCase()
    const password = req.body.password

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must contain at least 6 characters"
      })
    }

    const existingUser = await User.findOne({
      $or: [
        { username },
        { email }
      ]
    })

    if (existingUser) {
      return res.status(400).json({
        message: "Username or email already exists"
      })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
      username,
      email,
      password: hashedPassword
    })

    res.status(201).json({
      message: "Registration successful",
      userId: user._id.toString(),
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
    const email = req.body.email?.trim().toLowerCase()
    const password = req.body.password

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

    const token = createToken(user)

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

app.get("/api/me", authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      profilePicture: req.user.profilePicture,
      about: req.user.about,
      online: req.user.online,
      lastSeen: req.user.lastSeen
    }
  })
})

app.get("/api/users", authenticate, async (req, res) => {
  try {
    const search = req.query.search || ""

    const users = await User.find({
      _id: {
        $ne: req.user._id
      },
      username: {
        $regex: search,
        $options: "i"
      }
    })
      .select("username profilePicture about online lastSeen")
      .limit(30)

    res.json(users)
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch users"
    })
  }
})

app.get("/api/users/:id", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("username email profilePicture about online lastSeen")

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    res.json(user)
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch user"
    })
  }
})

app.patch("/api/profile", authenticate, async (req, res) => {
  try {
    const { about } = req.body

    if (typeof about === "string") {
      req.user.about = about.slice(0, 200)
    }

    await req.user.save()

    res.json({
      message: "Profile updated",
      user: {
        username: req.user.username,
        about: req.user.about,
        profilePicture: req.user.profilePicture
      }
    })
  } catch (error) {
    res.status(500).json({
      message: "Profile update failed"
    })
  }
})

app.get("/api/conversations", authenticate, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate("participants", "username profilePicture online lastSeen about")
      .populate("lastMessage")
      .sort({
        updatedAt: -1
      })

    res.json(conversations)
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch conversations"
    })
  }
})

app.post("/api/conversations/:userId", authenticate, async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot chat with yourself"
      })
    }

    const otherUser = await User.findById(req.params.userId)

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    const blocked = req.user.blockedUsers.some(
      id => id.toString() === otherUser._id.toString()
    )

    if (blocked) {
      return res.status(403).json({
        message: "User is blocked"
      })
    }

    const conversation = await createConversation(
      req.user._id,
      otherUser._id
    )

    const populated = await Conversation.findById(
      conversation._id
    ).populate(
      "participants",
      "username profilePicture online lastSeen about"
    )

    res.json(populated)
  } catch (error) {
    res.status(500).json({
      message: "Could not create conversation"
    })
  }
})

app.get(
  "/api/messages/:conversationId",
  authenticate,
  async (req, res) => {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participants: req.user._id
      })

      if (!conversation) {
        return res.status(404).json({
          message: "Conversation not found"
        })
      }

      const messages = await Message.find({
        conversationId: conversation._id
      })
        .populate("sender", "username profilePicture")
        .populate("receiver", "username profilePicture")
        .populate("replyTo")
        .sort({
          createdAt: 1
        })
        .limit(500)

      await Message.updateMany(
        {
          conversationId: conversation._id,
          receiver: req.user._id,
          read: false
        },
        {
          $set: {
            read: true
          }
        }
      )

      res.json(messages)
    } catch (error) {
      res.status(500).json({
        message: "Could not fetch messages"
      })
    }
  }
)

app.post(
  "/api/media",
  authenticate,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded"
        })
      }

      const mediaId = await saveMedia(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        {
          userId: req.user._id.toString()
        }
      )

      let type = "document"

      if (req.file.mimetype.startsWith("image/")) {
        type = "image"
      } else if (req.file.mimetype.startsWith("video/")) {
        type = "video"
      } else if (req.file.mimetype.startsWith("audio/")) {
        type = "audio"
      }

      res.status(201).json({
        mediaId,
        type,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/api/media/${mediaId}`
      })
    } catch (error) {
      console.log(error)

      res.status(500).json({
        message: "Media upload failed"
      })
    }
  }
)

app.get("/api/media/:id", async (req, res) => {
  try {
    const file = await getMedia(req.params.id)

    if (!file) {
      return res.status(404).send("File not found")
    }

    res.set(
      "Content-Type",
      file.contentType || "application/octet-stream"
    )

    res.set(
      "Content-Disposition",
      `inline; filename="${file.filename}"`
    )

    const downloadStream = getMediaBucket().openDownloadStream(
      file._id
    )

    downloadStream.on("error", () => {
      res.status(404).end()
    })

    downloadStream.pipe(res)
  } catch (error) {
    res.status(404).send("File not found")
  }
})

app.delete("/api/media/:id", authenticate, async (req, res) => {
  try {
    await deleteMedia(req.params.id)

    res.json({
      message: "Media deleted"
    })
  } catch (error) {
    res.status(500).json({
      message: "Could not delete media"
    })
  }
})

app.post("/api/block/:userId", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    if (
      !req.user.blockedUsers.some(
        id => id.toString() === user._id.toString()
      )
    ) {
      req.user.blockedUsers.push(user._id)
      await req.user.save()
    }

    res.json({
      message: "User blocked"
    })
  } catch (error) {
    res.status(500).json({
      message: "Could not block user"
    })
  }
})

app.delete("/api/block/:userId", authenticate, async (req, res) => {
  try {
    req.user.blockedUsers = req.user.blockedUsers.filter(
      id => id.toString() !== req.params.userId
    )

    await req.user.save()

    res.json({
      message: "User unblocked"
    })
  } catch (error) {
    res.status(500).json({
      message: "Could not unblock user"
    })
  }
})

app.post("/api/contacts/:userId", authenticate, async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({
        message: "Invalid contact"
      })
    }

    const existing = await Contact.findOne({
      owner: req.user._id,
      contact: req.params.userId
    })

    if (!existing) {
      await Contact.create({
        owner: req.user._id,
        contact: req.params.userId
      })
    }

    res.json({
      message: "Contact added"
    })
  } catch (error) {
    res.status(500).json({
      message: "Could not add contact"
    })
  }
})

app.get("/api/contacts", authenticate, async (req, res) => {
  try {
    const contacts = await Contact.find({
      owner: req.user._id
    }).populate(
      "contact",
      "username profilePicture about online lastSeen"
    )

    res.json(contacts)
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch contacts"
    })
  }
})

app.get("/api/calls", authenticate, async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [
        { caller: req.user._id },
        { receiver: req.user._id }
      ]
    })
      .populate("caller", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort({
        createdAt: -1
      })
      .limit(100)

    res.json(calls)
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch calls"
    })
  }
})

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token

    if (!token) {
      return next(new Error("Authentication required"))
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    const user = await User.findById(decoded.userId)

    if (!user) {
      return next(new Error("User not found"))
    }

    socket.user = user

    next()
  } catch (error) {
    next(new Error("Invalid token"))
  }
})

io.on("connection", async socket => {
  const user = socket.user

  onlineUsers.set(user._id.toString(), {
    socketId: socket.id,
    username: user.username
  })

  user.online = true
  user.lastSeen = new Date()
  await user.save()

  socket.join(user._id.toString())

  io.emit("userStatus", {
    userId: user._id.toString(),
    online: true,
    lastSeen: user.lastSeen
  })

  socket.on("privateMessage", async data => {
    try {
      const {
        receiverId,
        text,
        type = "text",
        mediaId = "",
        mediaName = "",
        mediaType = "",
        mediaSize = 0,
        replyTo = null
      } = data

      if (!receiverId) {
        return
      }

      if (!text && !mediaId) {
        return
      }

      const receiver = await User.findById(receiverId)

      if (!receiver) {
        return
      }

      const blockedByMe = user.blockedUsers.some(
        id => id.toString() === receiverId
      )

      const blockedMe = receiver.blockedUsers.some(
        id => id.toString() === user._id.toString()
      )

      if (blockedByMe || blockedMe) {
        socket.emit("messageError", {
          message: "You cannot message this user"
        })
        return
      }

      const conversation = await createConversation(
        user._id,
        receiver._id
      )

      const message = await Message.create({
        conversationId: conversation._id,
        sender: user._id,
        receiver: receiver._id,
        text,
        type,
        mediaId,
        mediaName,
        mediaType,
        mediaSize,
        replyTo
      })

      conversation.lastMessage = message._id
      conversation.updatedAt = new Date()
      await conversation.save()

      const populatedMessage = await Message.findById(
        message._id
      )
        .populate("sender", "username profilePicture")
        .populate("receiver", "username profilePicture")
        .populate("replyTo")

      io.to(receiver._id.toString()).emit(
        "privateMessage",
        populatedMessage
      )

      socket.emit("privateMessage", populatedMessage)
    } catch (error) {
      console.log(error)

      socket.emit("messageError", {
        message: "Message could not be sent"
      })
    }
  })

  socket.on("typing", data => {
    if (!data.receiverId) {
      return
    }

    io.to(data.receiverId).emit("typing", {
      userId: user._id.toString(),
      username: user.username,
      typing: data.typing
    })
  })

  socket.on("messageRead", async data => {
    try {
      if (!data.messageId) {
        return
      }

      const message = await Message.findById(data.messageId)

      if (!message) {
        return
      }

      if (
        message.receiver.toString() !==
        user._id.toString()
      ) {
        return
      }

      message.read = true
      await message.save()

      io.to(message.sender.toString()).emit(
        "messageRead",
        {
          messageId: message._id.toString()
        }
      )
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("editMessage", async data => {
    try {
      const message = await Message.findById(data.messageId)

      if (!message) {
        return
      }

      if (
        message.sender.toString() !==
        user._id.toString()
      ) {
        return
      }

      message.text = data.text
      message.edited = true
      message.updatedAt = new Date()

      await message.save()

      const populated = await Message.findById(message._id)
        .populate("sender", "username profilePicture")
        .populate("receiver", "username profilePicture")
        .populate("replyTo")

      io.to(message.sender.toString()).emit(
        "messageEdited",
        populated
      )

      io.to(message.receiver.toString()).emit(
        "messageEdited",
        populated
      )
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("deleteMessage", async data => {
    try {
      const message = await Message.findById(data.messageId)

      if (!message) {
        return
      }

      if (
        message.sender.toString() !==
        user._id.toString()
      ) {
        return
      }

      message.text = ""
      message.deleted = true
      message.updatedAt = new Date()

      await message.save()

      io.to(message.sender.toString()).emit(
        "messageDeleted",
        {
          messageId: message._id.toString()
        }
      )

      io.to(message.receiver.toString()).emit(
        "messageDeleted",
        {
          messageId: message._id.toString()
        }
      )
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("reaction", async data => {
    try {
      const message = await Message.findById(data.messageId)

      if (!message) {
        return
      }

      const existing = message.reactions.find(
        reaction =>
          reaction.user.toString() === user._id.toString()
      )

      if (existing) {
        existing.reaction = data.reaction
      } else {
        message.reactions.push({
          user: user._id,
          reaction: data.reaction
        })
      }

      await message.save()

      io.to(message.sender.toString()).emit(
        "reactionUpdated",
        {
          messageId: message._id.toString(),
          reactions: message.reactions
        }
      )

      io.to(message.receiver.toString()).emit(
        "reactionUpdated",
        {
          messageId: message._id.toString(),
          reactions: message.reactions
        }
      )
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("callUser", async data => {
    try {
      const target = onlineUsers.get(data.to)

      if (!target) {
        socket.emit("callUnavailable")
        return
      }

      const call = await Call.create({
        caller: user._id,
        receiver: data.to,
        type: data.type || "video",
        status: "calling"
      })

      io.to(target.socketId).emit("incomingCall", {
        callId: call._id.toString(),
        from: user._id.toString(),
        username: user.username,
        type: data.type || "video",
        offer: data.offer
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("callAccepted", async data => {
    try {
      if (data.callId) {
        await Call.findByIdAndUpdate(
          data.callId,
          {
            status: "accepted"
          }
        )
      }

      const target = onlineUsers.get(data.to)

      if (!target) {
        return
      }

      io.to(target.socketId).emit("callAccepted", {
        callId: data.callId,
        answer: data.answer
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("callRejected", async data => {
    try {
      if (data.callId) {
        await Call.findByIdAndUpdate(
          data.callId,
          {
            status: "rejected"
          }
        )
      }

      const target = onlineUsers.get(data.to)

      if (!target) {
        return
      }

      io.to(target.socketId).emit("callRejected")
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("iceCandidate", data => {
    const target = onlineUsers.get(data.to)

    if (!target) {
      return
    }

    io.to(target.socketId).emit("iceCandidate", {
      candidate: data.candidate
    })
  })

  socket.on("endCall", async data => {
    try {
      if (data.callId) {
        await Call.findByIdAndUpdate(
          data.callId,
          {
            status: "ended"
          }
        )
      }

      const target = onlineUsers.get(data.to)

      if (!target) {
        return
      }

      io.to(target.socketId).emit("endCall")
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("disconnect", async () => {
    const current = onlineUsers.get(user._id.toString())

    if (
      current &&
      current.socketId === socket.id
    ) {
      onlineUsers.delete(user._id.toString())

      user.online = false
      user.lastSeen = new Date()

      await user.save()

      io.emit("userStatus", {
        userId: user._id.toString(),
        online: false,
        lastSeen: user.lastSeen
      })
    }
  })
})

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  )
})