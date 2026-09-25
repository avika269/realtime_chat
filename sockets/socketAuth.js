import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

/**
 * Socket.io Connection Authentication Middleware
 */
export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL: JWT_SECRET environment variable is missing.");
      return next(new Error("Internal server configuration error"));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return next(new Error("Authentication token has expired"));
      }
      return next(new Error("Invalid authentication token"));
    }

    // Extract user ID flexibly
    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) {
      return next(new Error("Malformed authentication payload"));
    }

    // Fetch only necessary fields to reduce database/memory overhead
    const user = await User.findById(userId).select("_id username email role");

    if (!user) {
      return next(new Error("User account no longer exists"));
    }

    // Attach lean user context to the socket connection
    socket.user = user;

    next();
  } catch (error) {
    console.error("Socket Auth Error:", error);
    next(new Error("Authentication failed unexpectedly"));
  }
}
