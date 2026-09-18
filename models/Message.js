import mongoose from "mongoose"

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true
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
    enum: ["text", "image", "video", "audio", "document"],
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

messageSchema.index({ conversationId: 1, createdAt: 1 })

export const Message = mongoose.model("Message", messageSchema)