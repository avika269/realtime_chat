import express from "express"

import {
    uploadMedia,
    deleteMedia,
    upload
} from "../controllers/mediaController.js"

import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.post(
    "/upload",
    authenticate,
    upload.single("file"),
    uploadMedia
)

router.delete(
    "/delete",
    authenticate,
    deleteMedia
)

export default router