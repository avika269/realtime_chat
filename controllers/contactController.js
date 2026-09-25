import User from "../models/User.js"

export const getContacts = async (req, res) => {
    try {
        const users = await User.find({
            _id: {
                $ne: req.user.id
            }
        })
            .select(
                "name email profilePicture bio college status lastSeen"
            )
            .sort({ name: 1 })

        res.json(users)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const searchContacts = async (req, res) => {
    try {
        const query = req.query.q || ""

        if (!query.trim()) {
            return res.json([])
        }

        const users = await User.find({
            _id: {
                $ne: req.user.id
            },
            $or: [
                {
                    name: {
                        $regex: query,
                        $options: "i"
                    }
                },
                {
                    email: {
                        $regex: query,
                        $options: "i"
                    }
                }
            ]
        })
            .select(
                "name email profilePicture bio college status lastSeen"
            )
            .limit(30)

        res.json(users)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const getContact = async (req, res) => {
    try {
        const user = await User.findById(
            req.params.userId
        ).select(
            "name email profilePicture bio college status lastSeen"
        )

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        res.json(user)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}