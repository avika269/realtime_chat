const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9._%+-]+@akgec\.ac\.in$/i.test(v)
        },
        message: "Email must be a valid @akgec.ac.in college address"
      }
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId
      }
    },
    avatar: {
      type: String,
      default: ""
    },
    googleId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline"
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("User", userSchema)