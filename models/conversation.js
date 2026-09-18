import mongoose from "mongoose"

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

conversationSchema.index({ participants: 1 })

export async function createConversation(user1, user2) {
  let conversation = await Conversation.findOne({
    participants: {
      $all: [user1, user2],
      $size: 2
    }
  })

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [user1, user2]
    })
  }

  return conversation
}

export const Conversation = mongoose.model("Conversation", conversationSchema)