import express from "express";

import {
    createComment,
    getComments,
    updateComment,
    deleteComment
} from "../controllers/commentController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
    "/post/:postId",
    authMiddleware,
    getComments
);

router.post(
    "/post/:postId",
    authMiddleware,
    createComment
);

router.patch(
    "/:id",
    authMiddleware,
    updateComment
);

router.delete(
    "/:id",
    authMiddleware,
    deleteComment
);

export default router;