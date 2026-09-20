const User = require("../models/User")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { OAuth2Client } = require("google-auth-library")
const { registerSchema, loginSchema, googleAuthSchema, collegeEmailValidator } = require("../validators/authValidator")

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

exports.register = async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body)

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors[0].message
      return res.status(400).json({ message: errorMessage })
    }

    const { username, email, password } = parseResult.data

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    })

    if (existingUser) {
      return res.status(400).json({ message: "Username or email is already registered" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      username,
      email,
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
    const parseResult = loginSchema.safeParse(req.body)

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors[0].message
      return res.status(400).json({ message: errorMessage })
    }

    const { email, password } = parseResult.data

    const user = await User.findOne({ email })

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
    const parseResult = googleAuthSchema.safeParse(req.body)

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors[0].message
      return res.status(400).json({ message: errorMessage })
    }

    const { credential } = parseResult.data

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()
    const { email, name, picture, sub: googleId } = payload

    const emailCheck = collegeEmailValidator.safeParse(email)
    if (!emailCheck.success) {
      return res.status(403).json({
        message: "Access restricted: Only @akgec.ac.in Google accounts are permitted."
      })
    }

    const normalizedEmail = email.toLowerCase().trim()
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