import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { User } from "../models/User.js"

const JWT_SECRET = process.env.JWT_SECRET || "secret"

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  )
}

export async function register(req, res) {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email and password are required"
      })
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }]
    })

    if (existingUser) {
      return res.status(409).json({
        message: "Username or email already exists"
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword
    })

    const token = createToken(user)

    res.status(201).json({
      message: "Registration successful",
      token,
      username: user.username,
      userId: user._id.toString(),
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        about: user.about,
        profilePicture: user.profilePicture
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Registration failed" })
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      })
    }

    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    const token = createToken(user)

    res.json({
      message: "Login successful",
      token,
      username: user.username,
      userId: user._id.toString(),
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        about: user.about,
        profilePicture: user.profilePicture
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Login failed" })
  }
}

export async function getMe(req, res) {
  res.json({
    user: {
      _id: req.user._id.toString(),
      id: req.user._id.toString(),
      username: req.user.username,
      email: req.user.email,
      about: req.user.about,
      profilePicture: req.user.profilePicture,
      online: req.user.online,
      lastSeen: req.user.lastSeen
    }
  })
}

export async function updateProfile(req, res) {
  try {
    const { username, about, profilePicture } = req.body

    if (username !== undefined) req.user.username = username
    if (about !== undefined) req.user.about = about
    if (profilePicture !== undefined) req.user.profilePicture = profilePicture

    await req.user.save()

    res.json({
      message: "Profile updated",
      user: {
        id: req.user._id.toString(),
        username: req.user.username,
        email: req.user.email,
        about: req.user.about,
        profilePicture: req.user.profilePicture
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Profile update failed" })
  }
}