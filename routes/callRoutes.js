import express from "express"
import { getCalls } from "../controllers/callController.js"
import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.get("/", authenticate, getCalls)

export default router