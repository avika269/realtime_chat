import express from "express"

import {
    getMe,
    getUser,
    updateProfile,
    updateSettings,
    changePassword,
    searchUsers,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    deleteAccount,
    getPublicProfile
} from "../controllers/userController.js"

import { authenticate } from "../middleware/auth.js"
import { upload } from "../controllers/mediaController.js"

const router = express.Router()

router.get("/me", authenticate, getMe)

router.get("/search", authenticate, searchUsers)

router.get("/me/followers", authenticate, getFollowers)
router.get("/me/following", authenticate, getFollowing)

router.get("/:id/followers", authenticate, getFollowers)
router.get("/:id/following", authenticate, getFollowing)

router.get("/:id/profile", authenticate, getPublicProfile)
router.get("/:id", authenticate, getUser)

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

router.delete(
    "/account",
    authenticate,
    deleteAccount
)

export default router