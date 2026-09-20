const jwt = require("jsonwebtoken")

module.exports = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization") || req.header("authorization")

    if (!authHeader) {
      return res.status(401).json({ message: "Access denied. No token provided." })
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim()

    if (!token) {
      return res.status(401).json({ message: "Invalid token format." })
    }

    const secret = process.env.JWT_SECRET || "default_jwt_secret_key"
    const decoded = jwt.verify(token, secret)

    req.userId = decoded.id || decoded.userId || decoded._id
    req.user = decoded

    next()
  } catch (error) {
    return res.status(401).json({ message: "Authentication failed. Invalid or expired token." })
  }
}

authenticate.authenticate = authenticate
authenticate.auth = authenticate
module.exports = authenticate