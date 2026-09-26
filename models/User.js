import mongoose from "mongoose";

const userSchema =
    new mongoose.Schema(
        {
            name: {
                type: String,
                required: true,
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
                type: String
            },

            googleId: {
                type: String,
                default: ""
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
                enum: [
                    "online",
                    "offline"
                ],
                default: "offline"
            },

            lastSeen: {
                type: Date,
                default: null
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
    );

export default mongoose.model(
    "User",
    userSchema
);