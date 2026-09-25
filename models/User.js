import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },

        email: {
            type: String,
            required: true,
            unique: true
        },

        password: {
            type: String
        },

        googleId: {
            type: String
        },

        profilePicture: {
            type: String,
            default: ""
        },

        bio: {
            type: String,
            default: ""
        },

        college: {
            type: String,
            default: ""
        },

        status: {
            type: String,
            enum: ["online", "offline"],
            default: "offline"
        },

        lastSeen: {
            type: Date
        },

        notifications: {
            type: Boolean,
            default: true
        },

        darkMode: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
)

export default mongoose.model("User", userSchema)