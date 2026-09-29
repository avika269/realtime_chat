import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import nodemailer from "nodemailer"
import { OAuth2Client } from "google-auth-library"
import User from "../models/User.js"

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
)

const mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
})

const createToken = user => {
    return jwt.sign(
        {
            id: user._id.toString(),
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    )
}

const validCollegeEmail = email => {
    const domain =
        process.env.COLLEGE_EMAIL_DOMAIN

    if (!domain) {
        return true
    }

    return email
        .toLowerCase()
        .endsWith(
            "@" + domain.toLowerCase()
        )
}

export const register = async (req, res) => {
    try {
        const {
            name,
            email,
            password
        } = req.body

        if (
            !name ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                message:
                    "Name, email and password are required"
            })
        }

        if (!validCollegeEmail(email)) {
            return res.status(400).json({
                message:
                    "Only college email addresses are allowed"
            })
        }

        const existing =
            await User.findOne({ email })

        if (existing) {
            return res.status(409).json({
                message:
                    "User already exists"
            })
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            )

        const user =
            await User.create({
                name,
                email: email.toLowerCase(),
                password: hashedPassword
            })

        const token =
            createToken(user)

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const login = async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body

        const user =
            await User.findOne({
                email: email.toLowerCase()
            })

        if (!user) {
            return res.status(401).json({
                message:
                    "Invalid email or password"
            })
        }

        const valid =
            await bcrypt.compare(
                password,
                user.password || ""
            )

        if (!valid) {
            return res.status(401).json({
                message:
                    "Invalid email or password"
            })
        }

        user.status = "online"
        await user.save()

        res.json({
            token: createToken(user),
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({
                message: "Email is required"
            })
        }

        const normalizedEmail =
            email.trim().toLowerCase()

        if (!validCollegeEmail(normalizedEmail)) {
            return res.status(400).json({
                message:
                    "Only college email addresses are allowed"
            })
        }

        const user = await User.findOne({
            email: normalizedEmail
        })

        if (!user) {
            return res.status(404).json({
                message:
                    "No account found with this email"
            })
        }

        const otp = crypto
            .randomInt(100000, 1000000)
            .toString()

        const otpHash = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex")

        user.resetOtpHash = otpHash

        user.resetOtpExpiresAt =
            new Date(Date.now() + 10 * 60 * 1000)

        await user.save()

        await mailTransporter.sendMail({
            from: process.env.MAIL_USER,
            to: user.email,
            subject: "CampusChat Password Reset OTP",
            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: auto;
                    padding: 30px;
                ">

                    <h2>CampusChat</h2>

                    <h3>Password Reset Request</h3>

                    <p>
                        We received a request to reset your
                        CampusChat password.
                    </p>

                    <p>Your OTP is:</p>

                    <div style="
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        margin: 25px 0;
                    ">
                        ${otp}
                    </div>

                    <p>
                        This OTP will expire in 10 minutes.
                    </p>

                    <p>
                        If you did not request this password reset,
                        you can safely ignore this email.
                    </p>

                </div>
            `
        })

        res.json({
            message:
                "OTP sent successfully to your email"
        })

    } catch (error) {
        console.error(
            "Forgot password error:",
            error
        )

        res.status(500).json({
            message:
                "Failed to send OTP"
        })
    }
}

export const resetPassword = async (req, res) => {
    try {
        const {
            email,
            otp,
            newPassword
        } = req.body

        if (
            !email ||
            !otp ||
            !newPassword
        ) {
            return res.status(400).json({
                message:
                    "Email, OTP and new password are required"
            })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message:
                    "Password must contain at least 6 characters"
            })
        }

        const normalizedEmail =
            email.trim().toLowerCase()

        const user = await User.findOne({
            email: normalizedEmail
        })

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        if (
            !user.resetOtpHash ||
            !user.resetOtpExpiresAt
        ) {
            return res.status(400).json({
                message:
                    "No password reset request found"
            })
        }

        if (
            user.resetOtpExpiresAt.getTime() <
            Date.now()
        ) {
            user.resetOtpHash = null
            user.resetOtpExpiresAt = null

            await user.save()

            return res.status(400).json({
                message:
                    "OTP has expired. Please request a new OTP."
            })
        }

        const otpHash = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex")

        if (
            otpHash !== user.resetOtpHash
        ) {
            return res.status(400).json({
                message:
                    "Invalid OTP"
            })
        }

        user.password =
            await bcrypt.hash(
                newPassword,
                10
            )

        user.resetOtpHash = null
        user.resetOtpExpiresAt = null

        user.status = "online"

        await user.save()

        const token = createToken(user)

        res.json({
            message:
                "Password reset successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        })

    } catch (error) {
        console.error(
            "Reset password error:",
            error
        )

        res.status(500).json({
            message: error.message
        })
    }
}

export const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body

        if (!credential) {
            return res.status(400).json({
                message:
                    "Google credential is required"
            })
        }

        const ticket =
            await googleClient.verifyIdToken({
                idToken: credential,
                audience:
                    process.env.GOOGLE_CLIENT_ID
            })

        const payload =
            ticket.getPayload()

        const email =
            payload.email.toLowerCase()

        if (!validCollegeEmail(email)) {
            return res.status(403).json({
                message:
                    "Only college Google accounts are allowed"
            })
        }

        let user =
            await User.findOne({
                email
            })

        if (!user) {
            user = await User.create({
                name:
                    payload.name ||
                    "Google User",
                email,
                googleId: payload.sub,
                profilePicture:
                    payload.picture || ""
            })
        } else {
            user.googleId =
                payload.sub

            if (!user.profilePicture) {
                user.profilePicture =
                    payload.picture || ""
            }

            await user.save()
        }

        user.status = "online"
        await user.save()

        res.json({
            token: createToken(user),
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        })
    } catch (error) {
        res.status(401).json({
            message:
                "Google authentication failed"
        })
    }
}

export const logout = async (req, res) => {
    try {
        res.json({
            message: "Logged out successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}