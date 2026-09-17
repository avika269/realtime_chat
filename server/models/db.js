import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
})


const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },

  message: {
    type: String,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
})


export const User = mongoose.model("User", userSchema)

export const Message = mongoose.model("Message", messageSchema)


export async function connectDB() {

  try {

    await mongoose.connect(process.env.MONGO_URI)

    console.log("MongoDB connected successfully")

  } catch (error) {

    console.log("MongoDB connection failed:", error)

  }

}