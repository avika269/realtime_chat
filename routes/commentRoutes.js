import express from "express";

import {
    createComment,
    getComments,
    updateComment,
    deleteComment
} from "../controllers/commentController.js";

import {authenticate} from "../middleware/auth.js";

const router = express.Router();

router.get(
    "/post/:postId",
    authenticate,
    getComments
);

router.post(
    "/post/:postId",
    authenticate,
    createComment
);

router.patch(
    "/:id",
    authenticate,
    updateComment
);

router.delete(
    "/:id",
    authenticate,
    deleteComment
);

export default router;