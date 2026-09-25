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

import  { authenticate } from "../middleware/auth.js";

import upload from "../middleware/upload.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    getFeed
);

router.get(
    "/:id",
    authenticate,
    getPost
);

router.post(
    "/",
    authenticate,
    upload.single("image"),
    createPost
);

router.patch(
    "/:id",
    authenticate,
    upload.single("image"),
    updatePost
);

router.delete(
    "/:id",
    authenticate,
    deletePost
);

router.post(
    "/:id/like",
    authenticate,
    toggleLike
);

router.post(
    "/:id/repost",
   authenticate,
    toggleRepost
);

export default router;