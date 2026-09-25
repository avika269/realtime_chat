import express from "express";

import {
    sendMessage,
    getMessages,
    updateMessage,
    deleteMessage,
    markMessageSeen
} from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router =
    express.Router();

router.get(
    "/conversation/:conversationId",
    authMiddleware,
    getMessages
);

router.post(
    "/",
    authMiddleware,
    sendMessage
);

router.patch(
    "/:id",
    authMiddleware,
    updateMessage
);

router.delete(
    "/:id",
    authMiddleware,
    deleteMessage
);

router.post(
    "/:id/seen",
    authMiddleware,
    markMessageSeen
);

export default router;