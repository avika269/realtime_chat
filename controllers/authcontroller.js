import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { OAuth2Client } from "google-auth-library"
import User from "../models/User.js"



const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
)

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