import Post from "../models/Post.js"

export const createPost = async (req, res) => {
    try {
        const post = await Post.create({
            user: req.user.id,
            content: req.body.content,
            image: req.body.image || ""
        })

        res.status(201).json(post)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const getPosts = async (req, res) => {
    try {
        const posts = await Post.find()
            .populate("user", "name email profilePicture")
            .sort({ createdAt: -1 })

        res.json(posts)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const getPost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate("user", "name email profilePicture")

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        res.json(post)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const updatePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        if (post.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "You can only update your own post"
            })
        }

        post.content = req.body.content ?? post.content
        post.image = req.body.image ?? post.image

        await post.save()

        res.json(post)
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        if (post.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "You can only delete your own post"
            })
        }

        await Post.findByIdAndDelete(req.params.id)

        res.json({
            message: "Post deleted successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}