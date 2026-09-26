import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/conversation.js";

const onlineUsers =
    new Map();

const userSockets =
    new Map();

function getToken(socket) {

    const authToken =
        socket.handshake.auth?.token;

    if (authToken) {
        return authToken;
    }

    const header =
        socket.handshake.headers?.authorization;

    if (
        header &&
        header.startsWith("Bearer ")
    ) {
        return header.substring(7);
    }

    return null;
}


async function authenticateSocket(
    socket
) {

    const token =
        getToken(socket);

    if (!token) {
        return null;
    }

    try {

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        const user =
            await User.findById(
                decoded.id
            );

        return user;

    } catch (error) {

        return null;
    }
}


function addUserSocket(
    userId,
    socketId
) {

    const key =
        userId.toString();

    if (!userSockets.has(key)) {
        userSockets.set(
            key,
            new Set()
        );
    }

    userSockets
        .get(key)
        .add(socketId);

    onlineUsers.set(
        key,
        true
    );
}


function removeUserSocket(
    userId,
    socketId
) {

    const key =
        userId.toString();

    const sockets =
        userSockets.get(
            key
        );

    if (!sockets) {
        return false;
    }

    sockets.delete(
        socketId
    );

    if (
        sockets.size === 0
    ) {

        userSockets.delete(
            key
        );

        onlineUsers.delete(
            key
        );

        return true;
    }

    return false;
}


function emitToUser(
    userId,
    event,
    data
) {

    const sockets =
        userSockets.get(
            userId.toString()
        );

    if (!sockets) {
        return;
    }

    sockets.forEach(
        socketId => {

            const socket =
                global.io
                    .sockets
                    .sockets
                    .get(
                        socketId
                    );

            if (socket) {
                socket.emit(
                    event,
                    data
                );
            }
        }
    );
}


export default function socketHandler(
    io
) {

    global.io =
        io;

    io.on(
        "connection",
        async socket => {

            const user =
                await authenticateSocket(
                    socket
                );

            if (!user) {

                socket.emit(
                    "auth:error",
                    {
                        message:
                            "Socket authentication failed"
                    }
                );

                socket.disconnect();

                return;
            }

            const userId =
                user._id.toString();

            socket.userId =
                userId;

            socket.join(
                `user:${userId}`
            );

            addUserSocket(
                userId,
                socket.id
            );

            await User.findByIdAndUpdate(
                userId,
                {
                    status:
                        "online"
                }
            );

            io.emit(
                "presence:update",
                {
                    userId,
                    status: "online"
                }
            );

            console.log(
                `User ${user.name} connected`
            );


            socket.on(
                "conversation:join",
                conversationId => {

                    socket.join(
                        `conversation:${conversationId}`
                    );
                }
            );


            socket.on(
                "conversation:leave",
                conversationId => {

                    socket.leave(
                        `conversation:${conversationId}`
                    );
                }
            );


            socket.on(
                "message:send",
                async data => {

                    try {

                        const {
                            conversationId,
                            receiverId,
                            text
                        } = data;

                        if (
                            !conversationId ||
                            !receiverId ||
                            !String(
                                text || ""
                            ).trim()
                        ) {
                            return;
                        }

                        const conversation =
                            await Conversation.findById(
                                conversationId
                            );

                        if (!conversation) {
                            return;
                        }

                        const isParticipant =
                            conversation.participants.some(
                                id =>
                                    id.toString() ===
                                    userId
                            );

                        if (!isParticipant) {
                            return;
                        }

                        const message =
                            await Message.create({
                                conversation:
                                    conversationId,

                                sender:
                                    userId,

                                receiver:
                                    receiverId,

                                text:
                                    String(
                                        text
                                    ).trim(),

                                mediaType:
                                    "text"
                            });

                        conversation.lastMessage =
                            message._id;

                        conversation.lastMessageText =
                            message.text;

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

                        io.to(
                            `conversation:${conversationId}`
                        ).emit(
                            "message:new",
                            populatedMessage
                        );

                        emitToUser(
                            receiverId,
                            "message:new",
                            populatedMessage
                        );

                    } catch (error) {

                        console.error(
                            "message:send error",
                            error
                        );
                    }
                }
            );


            socket.on(
                "message:seen",
                async data => {

                    try {

                        const message =
                            await Message.findById(
                                data.messageId
                            );

                        if (!message) {
                            return;
                        }

                        if (
                            message.receiver.toString() !==
                            userId
                        ) {
                            return;
                        }

                        message.seen =
                            true;

                        message.seenAt =
                            new Date();

                        await message.save();

                        emitToUser(
                            message.sender,
                            "message:seen",
                            {
                                messageId:
                                    message._id,

                                seenAt:
                                    message.seenAt
                            }
                        );

                    } catch (error) {

                        console.error(
                            error
                        );
                    }
                }
            );


            socket.on(
                "typing:start",
                data => {

                    socket
                        .to(
                            `conversation:${data.conversationId}`
                        )
                        .emit(
                            "typing:start",
                            {
                                userId,
                                conversationId:
                                    data.conversationId
                            }
                        );
                }
            );


            socket.on(
                "typing:stop",
                data => {

                    socket
                        .to(
                            `conversation:${data.conversationId}`
                        )
                        .emit(
                            "typing:stop",
                            {
                                userId,
                                conversationId:
                                    data.conversationId
                            }
                        );
                }
            );


            socket.on(
                "message:edit",
                async data => {

                    try {

                        const message =
                            await Message.findById(
                                data.messageId
                            );

                        if (!message) {
                            return;
                        }

                        if (
                            message.sender.toString() !==
                            userId
                        ) {
                            return;
                        }

                        const text =
                            String(
                                data.text || ""
                            ).trim();

                        if (!text) {
                            return;
                        }

                        message.text =
                            text;

                        message.edited =
                            true;

                        message.editedAt =
                            new Date();

                        await message.save();

                        io.to(
                            `conversation:${message.conversation}`
                        ).emit(
                            "message:edited",
                            {
                                messageId:
                                    message._id,

                                text:
                                    message.text,

                                editedAt:
                                    message.editedAt
                            }
                        );

                    } catch (error) {

                        console.error(
                            error
                        );
                    }
                }
            );


            socket.on(
                "message:delete",
                async data => {

                    try {

                        const message =
                            await Message.findById(
                                data.messageId
                            );

                        if (!message) {
                            return;
                        }

                        if (
                            message.sender.toString() !==
                            userId
                        ) {
                            return;
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

                        io.to(
                            `conversation:${message.conversation}`
                        ).emit(
                            "message:deleted",
                            {
                                messageId:
                                    message._id
                            }
                        );

                    } catch (error) {

                        console.error(
                            error
                        );
                    }
                }
            );


            socket.on(
                "call:initiate",
                data => {

                    const {
                        targetUserId,
                        callType,
                        callId
                    } = data;

                    emitToUser(
                        targetUserId,
                        "call:incoming",
                        {
                            callId,
                            callerId:
                                userId,
                            callerName:
                                user.name,
                            callerPicture:
                                user.profilePicture,
                            callType
                        }
                    );
                }
            );


            socket.on(
                "call:accept",
                data => {

                    emitToUser(
                        data.callerId,
                        "call:accepted",
                        {
                            callId:
                                data.callId,
                            receiverId:
                                userId
                        }
                    );
                }
            );


            socket.on(
                "call:reject",
                data => {

                    emitToUser(
                        data.callerId,
                        "call:rejected",
                        {
                            callId:
                                data.callId,
                            receiverId:
                                userId
                        }
                    );
                }
            );


            socket.on(
                "call:end",
                data => {

                    emitToUser(
                        data.targetUserId,
                        "call:ended",
                        {
                            callId:
                                data.callId
                        }
                    );
                }
            );


            socket.on(
                "webrtc:offer",
                data => {

                    emitToUser(
                        data.targetUserId,
                        "webrtc:offer",
                        {
                            callerId:
                                userId,

                            callId:
                                data.callId,

                            offer:
                                data.offer
                        }
                    );
                }
            );


            socket.on(
                "webrtc:answer",
                data => {

                    emitToUser(
                        data.targetUserId,
                        "webrtc:answer",
                        {
                            receiverId:
                                userId,

                            callId:
                                data.callId,

                            answer:
                                data.answer
                        }
                    );
                }
            );


            socket.on(
                "webrtc:ice",
                data => {

                    emitToUser(
                        data.targetUserId,
                        "webrtc:ice",
                        {
                            callId:
                                data.callId,

                            candidate:
                                data.candidate
                        }
                    );
                }
            );


            socket.on(
                "disconnect",
                async () => {

                    const becameOffline =
                        removeUserSocket(
                            userId,
                            socket.id
                        );

                    if (
                        becameOffline
                    ) {

                        const lastSeen =
                            new Date();

                        await User.findByIdAndUpdate(
                            userId,
                            {
                                status:
                                    "offline",

                                lastSeen
                            }
                        );

                        io.emit(
                            "presence:update",
                            {
                                userId,
                                status:
                                    "offline",

                                lastSeen
                            }
                        );
                    }

                    console.log(
                        `User ${user.name} disconnected`
                    );
                }
            );
        }
    );
}