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
      trim: true
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
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("User", userSchema)