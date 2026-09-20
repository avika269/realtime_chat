import { Call } from "../models/call.js"

export async function getCalls(req, res) {
  try {
    const calls = await Call.find({
      $or: [{ caller: req.user._id }, { receiver: req.user._id }]
    })
      .populate("caller", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort({ createdAt: -1 })

    res.json(calls)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to load calls" })
  }
}