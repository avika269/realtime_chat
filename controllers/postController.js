import Post from "../models/Post.js"


export const createPost = async (req, res) => {
    try {
        const post = await Post.create({
            user: req.user.id,
            content: req.body.content,
            image: req.body.image || ""
        })

        const populatedPost =
            await Post.findById(post._id)
                .populate(
                    "user",
                    "name email profilePicture bio"
                )

        res.status(201).json(populatedPost)

    } catch (error) {
        console.error("Create post error:", error)

        res.status(500).json({
            message: "Failed to create post"
        })
    }
}


export const getPosts = async (req, res) => {
    try {
        const posts =
            await Post.find()
                .populate(
                    "user",
                    "name email profilePicture bio"
                )
                .sort({
                    createdAt: -1
                })

        res.json(posts)

    } catch (error) {
        console.error("Get posts error:", error)

        res.status(500).json({
            message: "Failed to get posts"
        })
    }
}


export const getPost = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            )
                .populate(
                    "user",
                    "name email profilePicture bio"
                )

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        res.json(post)

    } catch (error) {
        console.error("Get post error:", error)

        res.status(500).json({
            message: "Failed to get post"
        })
    }
}


export const updatePost = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            )

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        if (
            post.user.toString() !==
            req.user.id.toString()
        ) {
            return res.status(403).json({
                message:
                    "You can only update your own post"
            })
        }

        if (req.body.content !== undefined) {
            post.content =
                req.body.content
        }

        if (req.body.image !== undefined) {
            post.image =
                req.body.image
        }

        await post.save()

        const updatedPost =
            await Post.findById(
                post._id
            ).populate(
                "user",
                "name email profilePicture bio"
            )

        res.json(updatedPost)

    } catch (error) {
        console.error("Update post error:", error)

        res.status(500).json({
            message: "Failed to update post"
        })
    }
}


export const deletePost = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            )

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        if (
            post.user.toString() !==
            req.user.id.toString()
        ) {
            return res.status(403).json({
                message:
                    "You can only delete your own post"
            })
        }

        await Post.findByIdAndDelete(
            req.params.id
        )

        res.json({
            message:
                "Post deleted successfully"
        })

    } catch (error) {
        console.error("Delete post error:", error)

        res.status(500).json({
            message: "Failed to delete post"
        })
    }
}


/* =========================================================
   LIKE / UNLIKE POST
   ========================================================= */

export const toggleLike = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.id
            )

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        const userId =
            req.user.id.toString()

        const alreadyLiked =
            post.likes.some(
                id =>
                    id.toString() ===
                    userId
            )

        if (alreadyLiked) {

            post.likes =
                post.likes.filter(
                    id =>
                        id.toString() !==
                        userId
                )

            await post.save()

            return res.json({
                message:
                    "Post unliked successfully",

                liked: false,

                likesCount:
                    post.likes.length
            })
        }

        post.likes.push(
            req.user.id
        )

        await post.save()

        res.json({
            message:
                "Post liked successfully",

            liked: true,

            likesCount:
                post.likes.length
        })

    } catch (error) {
        console.error(
            "Toggle like error:",
            error
        )

        res.status(500).json({
            message:
                "Failed to like post"
        })
    }
}

export const toggleRepost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        const userId = req.user.id.toString()

        const alreadyReposted = post.reposts.some(
            id => id.toString() === userId
        )

        if (alreadyReposted) {
            post.reposts = post.reposts.filter(
                id => id.toString() !== userId
            )

            await post.save()

            return res.json({
                message: "Post unreposted successfully",
                reposted: false,
                repostsCount: post.reposts.length
            })
        }

        post.reposts.push(req.user.id)

        await post.save()

        res.json({
            message: "Post reposted successfully",
            reposted: true,
            repostsCount: post.reposts.length
        })

    } catch (error) {
        console.error("Toggle repost error:", error)

        res.status(500).json({
            message: "Failed to repost post"
        })
    }
}