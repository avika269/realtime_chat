import Contact from "../models/contact.js"
import User from "../models/User.js"

export const getContacts = async (
    req,
    res
) => {
    try {
        const contacts =
            await Contact.find({
                owner: req.user.id
            }).populate(
                "contact",
                "name email profilePicture status lastSeen"
            )

        res.json(
            contacts.map(item => item.contact)
        )
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const searchContacts = async (
    req,
    res
) => {
    try {
        const q =
            req.query.q || ""

        const users =
            await User.find({
                _id: {
                    $ne: req.user.id
                },
                $or: [
                    {
                        name: {
                            $regex: q,
                            $options: "i"
                        }
                    },
                    {
                        email: {
                            $regex: q,
                            $options: "i"
                        }
                    }
                ]
            }).select(
                "name email profilePicture status lastSeen"
            )

        res.json(users)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const getContact = async (
    req,
    res
) => {
    try {
        const user =
            await User.findById(
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