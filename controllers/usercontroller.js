import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Follow from "../models/Follow.js";

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("-password");

        res.json(user);
    } catch (error) {
        res.status(500).json({
            message: "Unable to get profile"
        });
    }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({
            message: "Unable to get user"
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, bio, college } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (name !== undefined) {
            user.name = name.trim();
        }

        if (bio !== undefined) {
            user.bio = bio.trim();
        }

        if (college !== undefined) {
            user.college = college.trim();
        }

        if (req.file) {
            user.profilePicture =
                `/uploads/${req.file.filename}`;
        }

        await user.save();

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
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Profile update failed"
        });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const {
            notifications,
            darkMode
        } = req.body;

        const user = await User.findById(
            req.user._id
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (notifications !== undefined) {
            user.notifications = Boolean(
                notifications
            );
        }

        if (darkMode !== undefined) {
            user.darkMode = Boolean(darkMode);
        }

        await user.save();

        res.json({
            message: "Settings updated",
            settings: {
                notifications: user.notifications,
                darkMode: user.darkMode
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Settings update failed"
        });
    }
};

export const changePassword = async (req, res) => {
    try {
        const {
            currentPassword,
            newPassword
        } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: "Both passwords are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must contain at least 6 characters"
            });
        }

        const user = await User.findById(
            req.user._id
        );

        if (!user || !user.password) {
            return res.status(400).json({
                message: "Password change is unavailable"
            });
        }

        const correct = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!correct) {
            return res.status(400).json({
                message: "Current password is incorrect"
            });
        }

        user.password = await bcrypt.hash(
            newPassword,
            12
        );

        await user.save();

        res.json({
            message: "Password changed successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Password change failed"
        });
    }
};

export const searchUsers = async (req, res) => {
    try {
        const query = String(
            req.query.q || ""
        ).trim();

        if (!query) {
            return res.json([]);
        }

        const users = await User.find({
            _id: {
                $ne: req.user._id
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
                "_id name email profilePicture bio status lastSeen"
            )
            .limit(20);

        res.json(users);
    } catch (error) {
        res.status(500).json({
            message: "User search failed"
        });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        await User.findByIdAndDelete(
            req.user._id
        );

        res.json({
            message: "Account deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Account deletion failed"
        });
    }
};

export const getPublicProfile = async (req, res) => {
    try {
        const user =
            await User.findById(
                req.params.id
            ).select(
                "-password"
            );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const followers =
            await Follow.countDocuments({
                following: user._id
            });

        const following =
            await Follow.countDocuments({
                follower: user._id
            });

        const posts =
            await Post.find({
                author: user._id
            })
                .populate(
                    "author",
                    "name email profilePicture bio"
                )
                .sort({
                    createdAt: -1
                });

        const isFollowing =
            await Follow.exists({
                follower: req.user._id,
                following: user._id
            });

        res.json({
            user,
            followers,
            following,
            isFollowing: Boolean(
                isFollowing
            ),
            posts
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to load profile"
        });
    }
};