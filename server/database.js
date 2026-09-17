import mongoose from "mongoose"
import { GridFSBucket, ObjectId } from "mongodb"

let mediaBucket

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  profilePicture: {
    type: String,
    default: ""
  },
  about: {
    type: String,
    default: "Hey there! I am using ChatApp."
  },
  online: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  text: {
    type: String,
    default: ""
  },
  type: {
    type: String,
    enum: [
      "text",
      "image",
      "video",
      "audio",
      "document"
    ],
    default: "text"
  },
  mediaId: {
    type: String,
    default: ""
  },
  mediaName: {
    type: String,
    default: ""
  },
  mediaType: {
    type: String,
    default: ""
  },
  mediaSize: {
    type: Number,
    default: 0
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reaction: String
  }],
  edited: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

const callSchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["audio", "video"],
    required: true
  },
  status: {
    type: String,
    enum: [
      "calling",
      "accepted",
      "rejected",
      "missed",
      "ended"
    ],
    default: "calling"
  },
  duration: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const contactSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export const User = mongoose.model("User", userSchema)
export const Conversation = mongoose.model("Conversation", conversationSchema)
export const Message = mongoose.model("Message", messageSchema)
export const Call = mongoose.model("Call", callSchema)
export const Contact = mongoose.model("Contact", contactSchema)

export async function connectDB() {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI)

    mediaBucket = new GridFSBucket(connection.connection.db, {
      bucketName: "media"
    })

    console.log("MongoDB connected successfully")
  } catch (error) {
    console.log("MongoDB connection failed")
  console.log("ERROR:", error.message)
  process.exit(1)
  }
}

export function getMediaBucket() {
  return mediaBucket
}

export async function createConversation(user1, user2) {
  let conversation = await Conversation.findOne({
    participants: {
      $all: [user1, user2]
    }
  })

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [user1, user2]
    })
  }

  return conversation
}

export async function saveMedia(buffer, filename, contentType, metadata = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = mediaBucket.openUploadStream(filename, {
      contentType,
      metadata
    })

    uploadStream.on("error", reject)

    uploadStream.on("finish", () => {
      resolve(uploadStream.id.toString())
    })

    uploadStream.end(buffer)
  })
}

export async function getMedia(fileId) {
  const id = new ObjectId(fileId)

  const files = await mongoose.connection.db
    .collection("media.files")
    .find({
      _id: id
    })
    .toArray()

  if (!files.length) {
    return null
  }

  return files[0]
}

export async function deleteMedia(fileId) {
  const id = new ObjectId(fileId)

  try {
    await mediaBucket.delete(id)
  } catch (error) {
    console.log(error)
  }
}