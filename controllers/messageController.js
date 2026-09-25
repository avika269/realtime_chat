import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

export const sendMessage = async (
    req,
    res
) => {
    try {
        const {
            conversationId,
            receiverId,
            text
        } = req.body;

        if (!conversationId) {
            return res.status(400).json({
                message: "Conversation ID is required"
            });
        }

        if (!receiverId) {
            return res.status(400).json({
                message: "Receiver ID is required"
            });
        }

        const conversation =
            await Conversation.findById(
                conversationId
            );

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        const isParticipant =
            conversation.participants.some(
                id =>
                    id.toString() ===
                    req.user._id.toString()
            );

        if (!isParticipant) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        const messageText =
            String(
                text || ""
            ).trim();

        if (!messageText) {
            return res.status(400).json({
                message: "Message cannot be empty"
            });
        }

        const message =
            await Message.create({
                conversation:
                    conversation._id,

                sender:
                    req.user._id,

                receiver:
                    receiverId,

                text:
                    messageText,

                mediaType:
                    "text"
            });

        conversation.lastMessage =
            message._id;

        conversation.lastMessageText =
            messageText;

        conversation.lastMessageAt =
            new Date();

        await conversation.save();

        const populatedMessage =
            await Message.findById(
                message._id
            )
                .populate(
                    "sender",
                    "name email profilePicture"
                )
                .populate(
                    "receiver",
                    "name email profilePicture"
                );

        res.status(201).json({
            message:
                populatedMessage
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to send message"
        });
    }
};


export const getMessages = async (
    req,
    res
) => {
    try {
        const conversation =
            await Conversation.findById(
                req.params.conversationId
            );

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        const isParticipant =
            conversation.participants.some(
                id =>
                    id.toString() ===
                    req.user._id.toString()
            );

        if (!isParticipant) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        const messages =
            await Message.find({
                conversation:
                    conversation._id
            })
                .populate(
                    "sender",
                    "name email profilePicture"
                )
                .populate(
                    "receiver",
                    "name email profilePicture"
                )
                .sort({
                    createdAt: 1
                });

        await Message.updateMany(
            {
                conversation:
                    conversation._id,

                receiver:
                    req.user._id,

                seen: false
            },
            {
                $set: {
                    seen: true,
                    seenAt: new Date()
                }
            }
        );

        res.json(
            messages
        );
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to load messages"
        });
    }
};


export const updateMessage = async (
    req,
    res
) => {
    try {
        const message =
            await Message.findById(
                req.params.id
            );

        if (!message) {
            return res.status(404).json({
                message: "Message not found"
            });
        }

        if (
            message.sender.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "You can only edit your own messages"
            });
        }

        if (message.deleted) {
            return res.status(400).json({
                message: "Deleted message cannot be edited"
            });
        }

        const text =
            String(
                req.body.text || ""
            ).trim();

        if (!text) {
            return res.status(400).json({
                message: "Message cannot be empty"
            });
        }

        message.text =
            text;

        message.edited =
            true;

        message.editedAt =
            new Date();

        await message.save();

        const updatedMessage =
            await Message.findById(
                message._id
            )
                .populate(
                    "sender",
                    "name email profilePicture"
                )
                .populate(
                    "receiver",
                    "name email profilePicture"
                );

        res.json({
            message:
                updatedMessage
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update message"
        });
    }
};


export const deleteMessage = async (
    req,
    res
) => {
    try {
        const message =
            await Message.findById(
                req.params.id
            );

        if (!message) {
            return res.status(404).json({
                message: "Message not found"
            });
        }

        if (
            message.sender.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "You can only delete your own messages"
            });
        }

        message.deleted =
            true;

        message.deletedAt =
            new Date();

        message.text =
            "";

        message.mediaUrl =
            "";

        await message.save();

        res.json({
            message: "Message deleted",
            id: message._id
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete message"
        });
    }
};


export const markMessageSeen = async (
    req,
    res
) => {
    try {
        const message =
            await Message.findById(
                req.params.id
            );

        if (!message) {
            return res.status(404).json({
                message: "Message not found"
            });
        }

        if (
            message.receiver.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        message.seen =
            true;

        message.seenAt =
            new Date();

        await message.save();

        res.json({
            message: "Message marked as seen"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to mark message"
        });
    }
};