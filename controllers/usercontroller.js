import bcrypt from "bcryptjs"
import mongoose from "mongoose"
import User from "../models/User.js"
import Post from "../models/Post.js"
import Follow from "../models/Follow.js"


const getUserId = (req) => {
    if (req.params.id === "me") {
        return req.user.id
    }

    return req.params.id
}


const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id)
}


export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password")

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        const followers = await Follow.countDocuments({
            following: user._id
        })

        const following = await Follow.countDocuments({
            follower: user._id
        })

        res.json({
            ...user.toObject(),
            followers,
            following
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message: "Unable to get profile"
        })
    }
}


export const getUser = async (req, res) => {
    try {
        const id = getUserId(req)

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid user ID"
            })
        }

        const user = await User.findById(id)
            .select("-password")

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        res.json(user)
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message: "Unable to get user"
        })
    }
}


export const updateProfile = async (req, res) => {
    try {
        const { name, bio, college } = req.body

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        if (name !== undefined) {
            user.name = name.trim()
        }

        if (bio !== undefined) {
            user.bio = bio.trim()
        }

        if (college !== undefined) {
            user.college = college.trim()
        }

        if (req.file) {
            user.profilePicture =
                `/uploads/${req.file.filename}`
        }

        await user.save()

        res.json({
            message: "Profile updated",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture,
                bio: user.bio,
                college: user.college
            }
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message: "Profile update failed"
        })
    }
}


export const updateSettings = async (req, res) => {
    try {
        const { notifications } = req.body

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        if (notifications !== undefined) {
            user.notifications = Boolean(notifications)
        }

        user.darkMode = false

        await user.save()

        res.json({
            message: "Settings updated",
            settings: {
                notifications: user.notifications,
                darkMode: false
            }
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message: "Settings update failed"
        })
    }
}


export const changePassword = async (req, res) => {
    try {
        const {
            currentPassword,
            newPassword
        } = req.body

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: "Both passwords are required"
            })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message:
                    "New password must contain at least 6 characters"
            })
        }

        const user = await User.findById(req.user.id)

        if (!user || !user.password) {
            return res.status(400).json({
                message:
                    "Password change is unavailable"
            })
        }

        const correct = await bcrypt.compare(
            currentPassword,
            user.password
        )

        if (!correct) {
            return res.status(400).json({
                message:
                    "Current password is incorrect"
            })
        }

        user.password = await bcrypt.hash(
            newPassword,
            12
        )

        await user.save()

        res.json({
            message:
                "Password changed successfully"
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message: "Password change failed"
        })
    }
}


export const searchUsers = async (req, res) => {
    try {
        const query = String(
            req.query.q || ""
        ).trim()

        if (!query) {
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
                "_id name email profilePicture bio college status lastSeen"
            )
            .limit(20)

        const results = await Promise.all(
            users.map(async user => {

                const isFollowing =
                    await Follow.exists({
                        follower: req.user.id,
                        following: user._id
                    })

                const followers =
                    await Follow.countDocuments({
                        following: user._id
                    })

                const following =
                    await Follow.countDocuments({
                        follower: user._id
                    })

                return {
                    ...user.toObject(),
                    followers,
                    following,
                    isFollowing: Boolean(isFollowing)
                }
            })
        )

        res.json(results)
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message: "User search failed"
        })
    }
}


export const followUser = async (req, res) => {
    try {
        const followerId = req.user.id
        const followingId = req.params.id

        if (!isValidObjectId(followingId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            })
        }

        if (
            followerId.toString() ===
            followingId.toString()
        ) {
            return res.status(400).json({
                message:
                    "You cannot follow yourself"
            })
        }

        const user = await User.findById(followingId)

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        const existingFollow =
            await Follow.findOne({
                follower: followerId,
                following: followingId
            })

        if (existingFollow) {
            return res.status(400).json({
                message:
                    "You are already following this user"
            })
        }

        await Follow.create({
            follower: followerId,
            following: followingId
        })

        const followers =
            await Follow.countDocuments({
                following: followingId
            })

        const following =
            await Follow.countDocuments({
                follower: followerId
            })

        res.json({
            message:
                "User followed successfully",
            followers,
            following,
            isFollowing: true
        })
    } catch (error) {
        console.error("Follow error:", error)

        res.status(500).json({
            message: "Failed to follow user"
        })
    }
}


export const unfollowUser = async (req, res) => {
    try {
        const followerId = req.user.id
        const followingId = req.params.id

        if (!isValidObjectId(followingId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            })
        }

        const follow =
            await Follow.findOneAndDelete({
                follower: followerId,
                following: followingId
            })

        if (!follow) {
            return res.status(400).json({
                message:
                    "You are not following this user"
            })
        }

        const followers =
            await Follow.countDocuments({
                following: followingId
            })

        const following =
            await Follow.countDocuments({
                follower: followerId
            })

        res.json({
            message:
                "User unfollowed successfully",
            followers,
            following,
            isFollowing: false
        })
    } catch (error) {
        console.error("Unfollow error:", error)

        res.status(500).json({
            message: "Failed to unfollow user"
        })
    }
}


export const getFollowers = async (req, res) => {
    try {
        const userId = getUserId(req)

        if (!isValidObjectId(userId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            })
        }

        const follows =
            await Follow.find({
                following: userId
            }).populate(
                "follower",
                "name email profilePicture bio college"
            )

        const followers = follows.map(
            item => item.follower
        )

        res.json({
            count: followers.length,
            followers
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message:
                "Failed to get followers"
        })
    }
}


export const getFollowing = async (req, res) => {
    try {
        const userId = getUserId(req)

        if (!isValidObjectId(userId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            })
        }

        const follows =
            await Follow.find({
                follower: userId
            }).populate(
                "following",
                "name email profilePicture bio college"
            )

        const following = follows.map(
            item => item.following
        )

        res.json({
            count: following.length,
            following
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message:
                "Failed to get following"
        })
    }
}


export const deleteAccount = async (req, res) => {
    try {
        await Follow.deleteMany({
            $or: [
                {
                    follower: req.user.id
                },
                {
                    following: req.user.id
                }
            ]
        })

        await User.findByIdAndDelete(
            req.user.id
        )

        res.json({
            message:
                "Account deleted successfully"
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message:
                "Account deletion failed"
        })
    }
}


export const getPublicProfile = async (req, res) => {
    try {
        const userId = getUserId(req)

        if (!isValidObjectId(userId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            })
        }

        const user =
            await User.findById(userId)
                .select("-password")

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        const followers =
            await Follow.countDocuments({
                following: user._id
            })

        const following =
            await Follow.countDocuments({
                follower: user._id
            })

        const posts =
            await Post.find({
                user: user._id
            })
                .populate(
                    "user",
                    "name email profilePicture bio"
                )
                .sort({
                    createdAt: -1
                })

        const isFollowing =
            await Follow.exists({
                follower: req.user.id,
                following: user._id
            })

        res.json({
            user,
            followers,
            following,
            isFollowing: Boolean(
                isFollowing
            ),
            posts
        })
    } catch (error) {
        console.error(error)

        res.status(500).json({
            message:
                "Failed to load profile"
        })
    }
}