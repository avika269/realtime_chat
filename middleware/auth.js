import jwt from "jsonwebtoken"
import { User } from "../models/User.js"

export function getTokenFromRequest(req) {
  const auth = req.headers.authorization
  if (!auth) return null

  const parts = auth.split(" ")
  if (parts.length !== 2) return null

  return parts[1]
}

export async function authenticate(req, res, next) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return res.status(401).json({ message: "Authentication required" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}