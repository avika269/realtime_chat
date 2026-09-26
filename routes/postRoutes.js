import express from "express"

import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost
} from "../controllers/postController.js"

import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.post("/", authenticate, createPost)
router.get("/", authenticate, getPosts)
router.get("/:id", authenticate, getPost)
router.patch("/:id", authenticate, updatePost)
router.delete("/:id", authenticate, deletePost)

export default router