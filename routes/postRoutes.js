import express from "express";

import {
    createPost,
    getFeed,
    getPost,
    updatePost,
    deletePost,
    toggleLike,
    toggleRepost
} from "../controllers/postController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getFeed
);

router.get(
    "/:id",
    authMiddleware,
    getPost
);

router.post(
    "/",
    authMiddleware,
    upload.single("image"),
    createPost
);

router.patch(
    "/:id",
    authMiddleware,
    upload.single("image"),
    updatePost
);

router.delete(
    "/:id",
    authMiddleware,
    deletePost
);

router.post(
    "/:id/like",
    authMiddleware,
    toggleLike
);

router.post(
    "/:id/repost",
    authMiddleware,
    toggleRepost
);

export default router;