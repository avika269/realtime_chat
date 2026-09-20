import { Conversation, createConversation } from "../models/conversation.js"
import { Message } from "../models/Message.js"
import { User } from "../models/User.js"

export async function getConversations(req, res) {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })

    res.json(conversations)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to load conversations" })
  }
}

export async function createOrGetConversation(req, res) {
  try {
    const otherUser = await User.findById(req.params.userId)

    if (!otherUser) {
      return res.status(404).json({ message: "User not found" })
    }

    const conversation = await createConversation(req.user._id, otherUser._id)
    await conversation.populate("participants", "-password")

    res.json(conversation)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to create conversation" })
  }
}

export async function getMessages(req, res) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user._id
    })

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" })
    }

    const messages = await Message.find({
      conversationId: req.params.conversationId
    })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .populate("replyTo")
      .sort({ createdAt: 1 })

    res.json(messages)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to load messages" })
  }
}