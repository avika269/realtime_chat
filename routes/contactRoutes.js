import express from "express"
import { addContact, getContacts, blockUser, unblockUser } from "../controllers/userController.js"
import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.post("/contacts/:userId", authenticate, addContact)
router.get("/contacts", authenticate, getContacts)
router.post("/block/:userId", authenticate, blockUser)
router.delete("/block/:userId", authenticate, unblockUser)

export default router