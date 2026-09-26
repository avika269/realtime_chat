import mongoose from "mongoose"

const callSchema = new mongoose.Schema(
    {
        caller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        type: {
            type: String,
            enum: ["audio", "video"],
            required: true
        },

        status: {
            type: String,
            enum: [
                "calling",
                "accepted",
                "rejected",
                "missed",
                "ended"
            ],
            default: "calling"
        },

        startedAt: {
            type: Date,
            default: Date.now
        },

        endedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
)

export default mongoose.model("Call", callSchema)