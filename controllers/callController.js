import Call from "../models/call.js"

export const createCall = async (
    req,
    res
) => {
    try {
        const {
            receiverId,
            type
        } = req.body

        if (
            !receiverId ||
            !["audio", "video"].includes(type)
        ) {
            return res.status(400).json({
                message:
                    "Receiver and valid call type are required"
            })
        }

        const call =
            await Call.create({
                caller: req.user.id,
                receiver: receiverId,
                type,
                status: "calling"
            })

        res.status(201).json(call)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const getCalls = async (
    req,
    res
) => {
    try {
        const calls =
            await Call.find({
                $or: [
                    {
                        caller: req.user.id
                    },
                    {
                        receiver: req.user.id
                    }
                ]
            })
                .populate(
                    "caller",
                    "name profilePicture"
                )
                .populate(
                    "receiver",
                    "name profilePicture"
                )
                .sort({
                    createdAt: -1
                })

        res.json(calls)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const updateCall = async (
    req,
    res
) => {
    try {
        const call =
            await Call.findOne({
                _id: req.params.callId,
                $or: [
                    {
                        caller: req.user.id
                    },
                    {
                        receiver: req.user.id
                    }
                ]
            })

        if (!call) {
            return res.status(404).json({
                message: "Call not found"
            })
        }

        call.status =
            req.body.status

        if (
            ["ended", "rejected", "missed"]
                .includes(call.status)
        ) {
            call.endedAt = new Date()
        }

        await call.save()

        res.json(call)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const deleteCall = async (
    req,
    res
) => {
    try {
        const call =
            await Call.findOneAndDelete({
                _id: req.params.callId,
                $or: [
                    {
                        caller: req.user.id
                    },
                    {
                        receiver: req.user.id
                    }
                ]
            })

        if (!call) {
            return res.status(404).json({
                message: "Call not found"
            })
        }

        res.json({
            message: "Call deleted"
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}