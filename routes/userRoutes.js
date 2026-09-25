import express from "express";

import {
    getMe,
    getUser,
    updateProfile,
    updateSettings,
    changePassword,
    searchUsers,
    deleteAccount,
    getPublicProfile
} from "../controllers/userController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get(
    "/me",
    authMiddleware,
    getMe
);

router.get(
    "/search",
    authMiddleware,
    searchUsers
);

router.get(
    "/profile/:id",
    authMiddleware,
    getPublicProfile
);

router.get(
    "/:id",
    authMiddleware,
    getUser
);

router.patch(
    "/profile",
    authMiddleware,
    upload.single("profilePicture"),
    updateProfile
);

router.patch(
    "/settings",
    authMiddleware,
    updateSettings
);

router.patch(
    "/password",
    authMiddleware,
    changePassword
);

router.delete(
    "/account",
    authMiddleware,
    deleteAccount
);

export default router;