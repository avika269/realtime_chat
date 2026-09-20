import { User } from "../models/User.js"
import { Message } from "../models/Message.js"
import { Call } from "../models/call.js"
import { createConversation } from "../models/conversation.js"

const onlineUsers = new Map()

export function registerChatSocket(io) {
  io.on("connection", async socket => {
    const user = socket.user
    const userId = user._id.toString()

    onlineUsers.set(userId, {
      socketId: socket.id,
      username: user.username
    })

    socket.join(userId)

    await User.findByIdAndUpdate(user._id, { online: true })

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
          socket.emit("messageError", { message: "Receiver is required" })
          return
        }

        const receiver = await User.findById(receiverId)
        if (!receiver) {
          socket.emit("messageError", { message: "Receiver not found" })
          return
        }

        const blockedByReceiver = receiver.blockedUsers.some(
          id => id.toString() === userId
        )
        const blockedBySender = user.blockedUsers.some(
          id => id.toString() === receiverId
        )

        if (blockedByReceiver || blockedBySender) {
          socket.emit("messageError", { message: "Message cannot be sent" })
          return
        }

        const conversation = await createConversation(user._id, receiver._id)

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

        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "username profilePicture")
          .populate("receiver", "username profilePicture")
          .populate("replyTo")

        io.to(receiverId).emit("privateMessage", populatedMessage)
        socket.emit("privateMessage", populatedMessage)
      } catch (error) {
        console.error(error)
        socket.emit("messageError", { message: "Message could not be sent" })
      }
    })

    socket.on("typing", data => {
      const targetUserId = data.to || data.receiverId
      if (!targetUserId) return

      io.to(targetUserId).emit("typing", {
        userId,
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
          { read: true },
          { new: true }
        )

        if (!message) return

        io.to(message.sender.toString()).emit("messageRead", {
          messageId: message._id.toString()
        })
      } catch (error) {
        console.error(error)
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
        const payload = {
          messageId: message._id.toString(),
          text: message.text,
          edited: true
        }

        io.to(receiverId).emit("messageEdited", payload)
        socket.emit("messageEdited", payload)
      } catch (error) {
        console.error(error)
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
        const payload = { messageId: message._id.toString() }

        io.to(receiverId).emit("messageDeleted", payload)
        socket.emit("messageDeleted", payload)
      } catch (error) {
        console.error(error)
      }
    })

    socket.on("reaction", async data => {
      try {
        const message = await Message.findById(data.messageId)
        if (!message) return

        const existingReaction = message.reactions.find(
          reaction => reaction.user.toString() === userId
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

        const payload = {
          messageId: message._id.toString(),
          reactions: message.reactions
        }

        io.to(message.sender.toString()).emit("reactionUpdated", payload)
        io.to(message.receiver.toString()).emit("reactionUpdated", payload)
      } catch (error) {
        console.error(error)
      }
    })

    socket.on("callUser", async data => {
      try {
        const { to, type, offer } = data
        if (!to || !type || !offer) {
          socket.emit("callUnavailable")
          return
        }

        const receiver = await User.findById(to)
        if (!receiver) {
          socket.emit("callUnavailable")
          return
        }

        const blockedByReceiver = receiver.blockedUsers.some(
          id => id.toString() === userId
        )
        const blockedByCaller = user.blockedUsers.some(
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
        console.error(error)
        socket.emit("callUnavailable")
      }
    })

    socket.on("callAccepted", async data => {
      try {
        const { to, callId, answer } = data
        if (!to || !callId || !answer) return

        await Call.findByIdAndUpdate(callId, { status: "accepted" })

        io.to(to).emit("callAccepted", {
          callId,
          from: userId,
          answer
        })
      } catch (error) {
        console.error(error)
      }
    })

    socket.on("callRejected", async data => {
      try {
        const { to, callId } = data
        if (callId) {
          await Call.findByIdAndUpdate(callId, { status: "rejected" })
        }
        if (!to) return

        io.to(to).emit("callRejected", {
          callId,
          from: userId
        })
      } catch (error) {
        console.error(error)
      }
    })

    socket.on("iceCandidate", data => {
      try {
        const { to, candidate } = data
        if (!to || !candidate) return

        io.to(to).emit("iceCandidate", {
          from: userId,
          candidate
        })
      } catch (error) {
        console.error(error)
      }
    })

    socket.on("endCall", async data => {
      try {
        const { to, callId } = data
        if (callId) {
          await Call.findByIdAndUpdate(callId, { status: "ended" })
        }
        if (!to) return

        io.to(to).emit("endCall", {
          callId,
          from: userId
        })
      } catch (error) {
        console.error(error)
      }
    })

    socket.on("disconnect", async () => {
      const currentUser = onlineUsers.get(userId)

      if (currentUser && currentUser.socketId === socket.id) {
        onlineUsers.delete(userId)

        await User.findByIdAndUpdate(user._id, {
          online: false,
          lastSeen: new Date()
        })

        io.emit("userStatus", {
          userId,
          online: false,
          username: user.username,
          lastSeen: new Date()
        })
      }
    })
  })
}