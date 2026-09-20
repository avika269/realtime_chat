const User = require("../models/User")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { OAuth2Client } = require("google-auth-library")

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const COLLEGE_DOMAIN = "@akgec.ac.in"

function isCollegeEmail(email) {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(COLLEGE_DOMAIN)
}

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" })
    }

    if (!isCollegeEmail(email)) {
      return res.status(400).json({ 
        message: "Registration restricted: Only @akgec.ac.in college email addresses are allowed" 
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: username.trim() }]
    })

    if (existingUser) {
      return res.status(400).json({ message: "Username or college email is already registered" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword
    })

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    if (!isCollegeEmail(email)) {
      return res.status(400).json({ 
        message: "Access denied: Only @akgec.ac.in college email addresses are allowed" 
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await User.findOne({ email: normalizedEmail })

    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid email or password" })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" })
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({ message: "Missing Google authentication credential" })
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()
    const { email, name, picture, sub: googleId } = payload

    if (!isCollegeEmail(email)) {
      return res.status(403).json({
        message: "Access restricted: Only @akgec.ac.in Google accounts are allowed to enter"
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    let user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      const baseUsername = normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "")
      let candidateUsername = baseUsername || `user_${Date.now().toString().slice(-4)}`
      let count = 1

      while (await User.findOne({ username: candidateUsername })) {
        candidateUsername = `${baseUsername}${count}`
        count++
      }

      user = await User.create({
        username: candidateUsername,
        email: normalizedEmail,
        avatar: picture || "",
        googleId
      })
    } else if (!user.googleId) {
      user.googleId = googleId
      if (picture && !user.avatar) {
        user.avatar = picture
      }
      await user.save()
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}