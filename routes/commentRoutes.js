import express from "express"

import {
    createComment,
    getCommentsByPost,
    updateComment,
    deleteComment
} from "../controllers/commentController.js"

import { authenticate } from "../middleware/auth.js"

const router = express.Router()


router.post(
    "/:postId",
    authenticate,
    createComment
)


router.get(
    "/:postId",
    authenticate,
    getCommentsByPost
)


router.patch(
    "/:id",
    authenticate,
    updateComment
)


router.delete(
    "/:id",
    authenticate,
    deleteComment
)


export default router