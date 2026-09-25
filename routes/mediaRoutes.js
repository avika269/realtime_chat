import express from "express"

import {
    uploadMedia,
    deleteMedia
} from "../controllers/mediaController.js"

import { authenticate } from "../middleware/auth.js"

import upload from "../middleware/upload.js"

const router = express.Router()

router.post(
    "/upload",
    authenticate,
    upload.single("file"),
    uploadMedia
)

router.delete(
    "/:filename",
    authenticate,
    deleteMedia
)

export default router