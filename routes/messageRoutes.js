import express from "express";

import {
    sendMessage,
    getMessages,
    updateMessage,
    deleteMessage,
    markMessageSeen
} from "../controllers/messageController.js";

import  { authenticate } from "../middleware/auth.js";

const router =
    express.Router();

router.get(
    "/conversation/:conversationId",
    authenticate,
    getMessages
);

router.post(
    "/",
    authenticate,
    sendMessage
);

router.patch(
    "/:id",
   authenticate,

    updateMessage
);

router.delete(
    "/:id",
    authenticate,
    deleteMessage
);

router.post(
    "/:id/seen",
     authenticate,
    markMessageSeen
);

export default router;