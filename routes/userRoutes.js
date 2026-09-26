import express from "express"

import {
    getMe,
    getUser,
    updateProfile,
    updateSettings,
    changePassword,
    searchUsers,
    deleteAccount,
    getPublicProfile,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing
} from "../controllers/userController.js"

import { authenticate } from "../middleware/auth.js"
import upload from "../middleware/upload.js"

const router = express.Router()

router.get(
    "/me",
    authenticate,
    getMe
)

router.get(
    "/search",
    authenticate,
    searchUsers
)

router.get(
    "/profile/:id",
    authenticate,
    getPublicProfile
)

router.get(
    "/:id",
    authenticate,
    getUser
)

router.patch(
    "/profile",
    authenticate,
    upload.single("profilePicture"),
    updateProfile
)

router.patch(
    "/settings",
    authenticate,
    updateSettings
)

router.patch(
    "/password",
    authenticate,
    changePassword
)

router.delete(
    "/account",
    authenticate,
    deleteAccount
)

router.post(
    "/:id/follow",
    authenticate,
    followUser
)

router.delete(
    "/:id/follow",
    authenticate,
    unfollowUser
)

router.get(
    "/:id/followers",
    authenticate,
    getFollowers
)

router.get(
    "/:id/following",
    authenticate,
    getFollowing
)

export default router