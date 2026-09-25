import mongoose from "mongoose"

const contactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
)

contactSchema.index({ owner: 1, contact: 1 }, { unique: true })

export const Contact = mongoose.model("Contact", contactSchema)
export default Contact