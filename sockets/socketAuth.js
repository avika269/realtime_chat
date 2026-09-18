import jwt from "jsonwebtoken"
import { User } from "../models/User.js"

const JWT_SECRET = process.env.JWT_SECRET || "secret"

export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error("Authentication required"))

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.id)

    if (!user) return next(new Error("User not found"))

    socket.user = user
    next()
  } catch (error) {
    next(new Error("Invalid authentication"))
  }
}