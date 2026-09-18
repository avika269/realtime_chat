import express from "express"
import { getConversations, createOrGetConversation, getMessages } from "../controllers/chatController.js"
import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.get("/conversations", authenticate, getConversations)
router.post("/conversations/:userId", authenticate, createOrGetConversation)
router.get("/messages/:conversationId", authenticate, getMessages)

export default router