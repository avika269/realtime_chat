import Post from "../models/Post.js";
import Comment from "../models/Comment.js";

export const createPost = async (req, res) => {
    try {
        const content = String(
            req.body.content || ""
        ).trim();

        const image = req.file
            ? `/uploads/${req.file.filename}`
            : "";

        if (!content && !image) {
            return res.status(400).json({
                message: "Post cannot be empty"
            });
        }

        if (content.length > 10000) {
            return res.status(400).json({
                message: "Post is too long"
            });
        }

        const post = await Post.create({
            author: req.user._id,
            content,
            image
        });

        const populatedPost =
            await Post.findById(post._id)
                .populate(
                    "author",
                    "name email profilePicture bio"
                );

        res.status(201).json({
            message: "Post created successfully",
            post: populatedPost
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create post"
        });
    }
};


export const getFeed = async (req, res) => {
    try {
        const page =
            Math.max(
                Number(req.query.page) || 1,
                1
            );

        const limit =
            Math.min(
                Number(req.query.limit) || 20,
                50
            );

        const skip =
            (page - 1) * limit;

        const posts =
            await Post.find()
                .populate(
                    "author",
                    "name email profilePicture bio"
                )
                .sort({
                    createdAt: -1
                })
                .skip(skip)
                .limit(limit);

        const total =
            await Post.countDocuments();

        res.json({
            posts,
            page,
            limit,
            total,
            hasMore:
                skip + posts.length < total
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to load feed"
        });
    }
};


export const getPost = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            ).populate(
                "author",
                "name email profilePicture bio"
            );

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            });
        }

        res.json(post);
    } catch (error) {
        res.status(500).json({
            message: "Failed to load post"
        });
    }
};


export const updatePost = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            );

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            });
        }

        if (
            post.author.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "You can only edit your own post"
            });
        }

        const content =
            String(
                req.body.content || ""
            ).trim();

        const image =
            req.file
                ? `/uploads/${req.file.filename}`
                : post.image;

        if (!content && !image) {
            return res.status(400).json({
                message: "Post cannot be empty"
            });
        }

        post.content = content;
        post.image = image;

        await post.save();

        const updatedPost =
            await Post.findById(post._id)
                .populate(
                    "author",
                    "name email profilePicture bio"
                );

        res.json({
            message: "Post updated successfully",
            post: updatedPost
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update post"
        });
    }
};


export const deletePost = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            );

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            });
        }

        if (
            post.author.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "You can only delete your own post"
            });
        }

        await Comment.deleteMany({
            post: post._id
        });

        await Post.findByIdAndDelete(
            post._id
        );

        res.json({
            message: "Post deleted successfully"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete post"
        });
    }
};


export const toggleLike = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            );

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            });
        }

        const userId =
            req.user._id.toString();

        const index =
            post.likes.findIndex(
                id =>
                    id.toString() ===
                    userId
            );

        let liked;

        if (index === -1) {
            post.likes.push(
                req.user._id
            );

            liked = true;
        } else {
            post.likes.splice(
                index,
                1
            );

            liked = false;
        }

        await post.save();

        res.json({
            liked,
            likes: post.likes.length
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Like operation failed"
        });
    }
};


export const toggleRepost = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            );

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            });
        }

        const userId =
            req.user._id.toString();

        const index =
            post.reposts.findIndex(
                id =>
                    id.toString() ===
                    userId
            );

        let reposted;

        if (index === -1) {
            post.reposts.push(
                req.user._id
            );

            reposted = true;
        } else {
            post.reposts.splice(
                index,
                1
            );

            reposted = false;
        }

        await post.save();

        res.json({
            reposted,
            reposts: post.reposts.length
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Repost operation failed"
        });
    }
};