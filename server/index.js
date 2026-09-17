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
  getMediaBucket,
  deleteMedia
} from "./database.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const JWT_SECRET = process.env.JWT_SECRET || "secret"

const app = express()

app.use(express.json({ limit: "10mb" }))
app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`)
})

const io = new Server(expressServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
})

await connectDB()

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  )
}

function getTokenFromRequest(req) {
  const auth = req.headers.authorization

  if (!auth) return null

  const parts = auth.split(" ")

  if (parts.length !== 2) return null

  return parts[1]
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

    const user = await User.findById(decoded.id)

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
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email and password are required"
      })
    }

    const existingUser = await User.findOne({
      $or: [
        { username },
        { email: email.toLowerCase() }
      ]
    })

    if (existingUser) {
      return res.status(409).json({
        message: "Username or email already exists"
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword
    })

    const token = createToken(user)

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        about: user.about,
        profilePicture: user.profilePicture
      }
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

    const user = await User.findOne({
      email: email.toLowerCase()
    })

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
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        about: user.about,
        profilePicture: user.profilePicture
      }
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
      id: req.user._id.toString(),
      username: req.user.username,
      email: req.user.email,
      about: req.user.about,
      profilePicture: req.user.profilePicture,
      online: req.user.online,
      lastSeen: req.user.lastSeen
    }
  })
})

app.get("/api/users", authenticate, async (req, res) => {
  try {
    const search = req.query.search || ""

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        {
          username: {
            $regex: search,
            $options: "i"
          }
        },
        {
          email: {
            $regex: search,
            $options: "i"
          }
        }
      ]
    })
      .select("-password")
      .limit(50)

    res.json(users)
  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Unable to load users"
    })
  }
})

app.get("/api/users/:id", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    res.json(user)
  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Unable to load user"
    })
  }
})

app.patch("/api/profile", authenticate, async (req, res) => {
  try {
    const { username, about, profilePicture } = req.body

    if (username !== undefined) {
      req.user.username = username
    }

    if (about !== undefined) {
      req.user.about = about
    }

    if (profilePicture !== undefined) {
      req.user.profilePicture = profilePicture
    }

    await req.user.save()

    res.json({
      message: "Profile updated",
      user: {
        id: req.user._id.toString(),
        username: req.user.username,
        email: req.user.email,
        about: req.user.about,
        profilePicture: req.user.profilePicture
      }
    })
  } catch (error) {
    console.log(error)

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
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({
        updatedAt: -1
      })

    res.json(conversations)
  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Unable to load conversations"
    })
  }
})

app.post(
  "/api/conversations/:userId",
  authenticate,
  async (req, res) => {
    try {
      const otherUser = await User.findById(req.params.userId)

      if (!otherUser) {
        return res.status(404).json({
          message: "User not found"
        })
      }

      const conversation = await createConversation(
        req.user._id,
        otherUser._id
      )

      await conversation.populate(
        "participants",
        "-password"
      )

      res.json(conversation)
    } catch (error) {
      console.log(error)

      res.status(500).json({
        message: "Unable to create conversation"
      })
    }
  }
)

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
        conversationId: req.params.conversationId
      })
        .populate("sender", "username profilePicture")
        .populate("receiver", "username profilePicture")
        .populate("replyTo")
        .sort({
          createdAt: 1
        })

      res.json(messages)
    } catch (error) {
      console.log(error)

      res.status(500).json({
        message: "Unable to load messages"
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
          uploadedBy: req.user._id.toString()
        }
      )

      res.json({
        message: "File uploaded",
        mediaId,
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size
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
      return res.status(404).json({
        message: "File not found"
      })
    }

    res.setHeader(
      "Content-Type",
      file.contentType || "application/octet-stream"
    )

    const bucket = getMediaBucket()

    const stream = bucket.openDownloadStream(file._id)

    stream.on("error", () => {
      res.status(404).end()
    })

    stream.pipe(res)
  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Unable to load media"
    })
  }
})

app.delete(
  "/api/media/:id",
  authenticate,
  async (req, res) => {
    try {
      await deleteMedia(req.params.id)

      res.json({
        message: "Media deleted"
      })
    } catch (error) {
      console.log(error)

      res.status(500).json({
        message: "Unable to delete media"
      })
    }
  }
)

app.post(
  "/api/block/:userId",
  authenticate,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId)

      if (!user) {
        return res.status(404).json({
          message: "User not found"
        })
      }

      const alreadyBlocked = req.user.blockedUsers.some(
        id => id.toString() === user._id.toString()
      )

      if (!alreadyBlocked) {
        req.user.blockedUsers.push(user._id)
        await req.user.save()
      }

      res.json({
        message: "User blocked"
      })
    } catch (error) {
      console.log(error)

      res.status(500).json({
        message: "Unable to block user"
      })
    }
  }
)

app.delete(
  "/api/block/:userId",
  authenticate,
  async (req, res) => {
    try {
      req.user.blockedUsers =
        req.user.blockedUsers.filter(
          id => id.toString() !== req.params.userId
        )

      await req.user.save()

      res.json({
        message: "User unblocked"
      })
    } catch (error) {
      console.log(error)

      res.status(500).json({
        message: "Unable to unblock user"
      })
    }
  }
)

app.post(
  "/api/contacts/:userId",
  authenticate,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId)

      if (!user) {
        return res.status(404).json({
          message: "User not found"
        })
      }

      const existingContact = await Contact.findOne({
        owner: req.user._id,
        contact: user._id
      })

      if (!existingContact) {
        await Contact.create({
          owner: req.user._id,
          contact: user._id
        })
      }

      res.json({
        message: "Contact added"
      })
    } catch (error) {
      console.log(error)

      res.status(500).json({
        message: "Unable to add contact"
      })
    }
  }
)

app.get("/api/contacts", authenticate, async (req, res) => {
  try {
    const contacts = await Contact.find({
      owner: req.user._id
    }).populate("contact", "-password")

    res.json(contacts)
  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Unable to load contacts"
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

    res.json(calls)
  } catch (error) {
    console.log(error)

    res.status(500).json({
      message: "Unable to load calls"
    })
  }
})

const onlineUsers = new Map()

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error("Authentication required"))
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    const user = await User.findById(decoded.id)

    if (!user) {
      return next(new Error("User not found"))
    }

    socket.user = user

    next()
  } catch (error) {
    next(new Error("Invalid authentication"))
  }
})

io.on("connection", async socket => {
  const user = socket.user

  const userId = user._id.toString()

  onlineUsers.set(userId, {
    socketId: socket.id,
    username: user.username
  })

  socket.join(userId)

  await User.findByIdAndUpdate(user._id, {
    online: true
  })

  io.emit("userStatus", {
    userId,
    online: true,
    username: user.username
  })

  socket.on("privateMessage", async data => {
    try {
      const {
        receiverId,
        text = "",
        type = "text",
        mediaId = "",
        mediaName = "",
        mediaType = "",
        mediaSize = 0,
        replyTo = null
      } = data

      if (!receiverId) {
        socket.emit("messageError", {
          message: "Receiver is required"
        })
        return
      }

      const receiver = await User.findById(receiverId)

      if (!receiver) {
        socket.emit("messageError", {
          message: "Receiver not found"
        })
        return
      }

      const blockedByReceiver = receiver.blockedUsers.some(
        id => id.toString() === userId
      )

      const blockedBySender = user.blockedUsers.some(
        id => id.toString() === receiverId
      )

      if (blockedByReceiver || blockedBySender) {
        socket.emit("messageError", {
          message: "Message cannot be sent"
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

      io.to(receiverId).emit(
        "privateMessage",
        populatedMessage
      )

      socket.emit(
        "privateMessage",
        populatedMessage
      )
    } catch (error) {
      console.log(error)

      socket.emit("messageError", {
        message: "Message could not be sent"
      })
    }
  })

  socket.on("typing", data => {
    if (!data.to) return

    io.to(data.to).emit("typing", {
      from: userId,
      username: user.username,
      typing: data.typing
    })
  })

  socket.on("messageRead", async data => {
    try {
      if (!data.messageId) return

      const message = await Message.findByIdAndUpdate(
        data.messageId,
        {
          read: true
        },
        {
          new: true
        }
      )

      if (!message) return

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
      const message = await Message.findOne({
        _id: data.messageId,
        sender: user._id
      })

      if (!message) return

      message.text = data.text
      message.edited = true
      message.updatedAt = new Date()

      await message.save()

      const receiverId = message.receiver.toString()

      io.to(receiverId).emit("messageEdited", {
        messageId: message._id.toString(),
        text: message.text,
        edited: true
      })

      socket.emit("messageEdited", {
        messageId: message._id.toString(),
        text: message.text,
        edited: true
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("deleteMessage", async data => {
    try {
      const message = await Message.findOne({
        _id: data.messageId,
        sender: user._id
      })

      if (!message) return

      message.deleted = true
      message.text = "This message was deleted"
      message.updatedAt = new Date()

      await message.save()

      const receiverId = message.receiver.toString()

      io.to(receiverId).emit("messageDeleted", {
        messageId: message._id.toString()
      })

      socket.emit("messageDeleted", {
        messageId: message._id.toString()
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("reaction", async data => {
    try {
      const message = await Message.findById(
        data.messageId
      )

      if (!message) return

      const existingReaction =
        message.reactions.find(
          reaction =>
            reaction.user.toString() === userId
        )

      if (existingReaction) {
        existingReaction.reaction = data.reaction
      } else {
        message.reactions.push({
          user: user._id,
          reaction: data.reaction
        })
      }

      await message.save()

      const receiverId = message.receiver.toString()

      const payload = {
        messageId: message._id.toString(),
        reactions: message.reactions
      }

      io.to(receiverId).emit(
        "reactionUpdated",
        payload
      )

      socket.emit(
        "reactionUpdated",
        payload
      )
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("callUser", async data => {
    try {
      const {
        to,
        type,
        offer
      } = data

      if (!to || !type || !offer) {
        socket.emit("callUnavailable")
        return
      }

      const receiver = await User.findById(to)

      if (!receiver) {
        socket.emit("callUnavailable")
        return
      }

      const blockedByReceiver =
        receiver.blockedUsers.some(
          id => id.toString() === userId
        )

      const blockedByCaller =
        user.blockedUsers.some(
          id => id.toString() === to
        )

      if (blockedByReceiver || blockedByCaller) {
        socket.emit("callUnavailable")
        return
      }

      const targetSocket = onlineUsers.get(to)

      if (!targetSocket) {
        socket.emit("callUnavailable")
        return
      }

      const call = await Call.create({
        caller: user._id,
        receiver: receiver._id,
        type,
        status: "calling"
      })

      io.to(to).emit("incomingCall", {
        callId: call._id.toString(),
        from: userId,
        username: user.username,
        type,
        offer
      })
    } catch (error) {
      console.log(error)

      socket.emit("callUnavailable")
    }
  })

  socket.on("callAccepted", async data => {
    try {
      const {
        to,
        callId,
        answer
      } = data

      if (!to || !callId || !answer) {
        return
      }

      await Call.findByIdAndUpdate(
        callId,
        {
          status: "accepted"
        }
      )

      io.to(to).emit("callAccepted", {
        callId,
        from: userId,
        answer
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("callRejected", async data => {
    try {
      const {
        to,
        callId
      } = data

      console.log(
        `Call rejected by ${user.username}`
      )

      if (callId) {
        await Call.findByIdAndUpdate(
          callId,
          {
            status: "rejected"
          }
        )
      }

      if (!to) return

      io.to(to).emit("callRejected", {
        callId,
        from: userId
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("iceCandidate", data => {
    try {
      const {
        to,
        candidate
      } = data

      if (!to || !candidate) return

      io.to(to).emit("iceCandidate", {
        from: userId,
        candidate
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("endCall", async data => {
    try {
      const {
        to,
        callId
      } = data

      if (callId) {
        await Call.findByIdAndUpdate(
          callId,
          {
            status: "ended"
          }
        )
      }

      if (!to) return

      io.to(to).emit("endCall", {
        callId,
        from: userId
      })
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("disconnect", async () => {
    const currentUser = onlineUsers.get(userId)

    if (
      currentUser &&
      currentUser.socketId === socket.id
    ) {
      onlineUsers.delete(userId)

      await User.findByIdAndUpdate(
        user._id,
        {
          online: false,
          lastSeen: new Date()
        }
      )

      io.emit("userStatus", {
        userId,
        online: false,
        username: user.username,
        lastSeen: new Date()
      })
    }
  })
})

app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  )
})