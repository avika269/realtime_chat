import express from "express"

import {
    register,
    login,
    logout,
    forgotPassword,
    resetPassword,
    googleLogin
} from "../controllers/authcontroller.js"

import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.post(
    "/register",
    register
)

router.post(
    "/login",
    login
)

router.post(
    "/forgot-password",
    forgotPassword
)

router.post(
    "/reset-password",
    resetPassword
)

router.post(
    "/google",
    googleLogin
)

router.post(
    "/logout",
    authenticate,
    logout
)

router.get(
    "/config",
    (req, res) => {
        res.json({
            googleClientId:
                process.env.GOOGLE_CLIENT_ID || ""
        })
    }
)

export default router