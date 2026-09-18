import express from "express"
import { uploadMedia, streamMedia, deleteMediaFile } from "../controllers/mediaController.js"
import { authenticate } from "../middleware/auth.js"
import { upload } from "../middleware/upload.js"

const router = express.Router()

router.post("/", authenticate, upload.single("file"), uploadMedia)
router.get("/:id", streamMedia)
router.delete("/:id", authenticate, deleteMediaFile)

export default router