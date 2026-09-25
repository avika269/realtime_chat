import Conversation from "../models/Conversation.js"
import Message from "../models/Message.js"

export const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user.id
        })
            .populate(
                "participants",
                "name email profilePicture status lastSeen"
            )
            .sort({ updatedAt: -1 })

        res.json(conversations)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const createOrGetConversation = async (req, res) => {
    try {
        const { userId } = req.params

        let conversation = await Conversation.findOne({
            participants: {
                $all: [req.user.id, userId]
            }
        })

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [
                    req.user.id,
                    userId
                ]
            })
        }

        conversation = await Conversation.findById(
            conversation._id
        ).populate(
            "participants",
            "name email profilePicture status lastSeen"
        )

        res.json(conversation)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: req.user.id
        })

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            })
        }

        const messages = await Message.find({
            conversation: conversationId
        })
            .populate(
                "sender",
                "name profilePicture"
            )
            .sort({ createdAt: 1 })

        res.json(messages)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}