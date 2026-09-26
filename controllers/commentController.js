import Comment from "../models/Comment.js"
import Post from "../models/Post.js"


export const createComment = async (req, res) => {
    try {
        const { text } = req.body

        if (!text || !text.trim()) {
            return res.status(400).json({
                message: "Comment cannot be empty"
            })
        }

        const post = await Post.findById(
            req.params.postId
        )

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            })
        }

        const comment = await Comment.create({
            post: req.params.postId,
            user: req.user.id,
            text: text.trim()
        })

        const result = await Comment.findById(
            comment._id
        ).populate(
            "user",
            "name email profilePicture"
        )

        res.status(201).json(result)

    } catch (error) {
        console.error(
            "Create comment error:",
            error
        )

        res.status(500).json({
            message: "Failed to create comment"
        })
    }
}


export const getCommentsByPost = async (req, res) => {
    try {
        const comments = await Comment.find({
            post: req.params.postId
        })
            .populate(
                "user",
                "name email profilePicture"
            )
            .sort({
                createdAt: 1
            })

        res.json(comments)

    } catch (error) {
        console.error(
            "Get comments error:",
            error
        )

        res.status(500).json({
            message: "Failed to get comments"
        })
    }
}


export const updateComment = async (req, res) => {
    try {
        const comment = await Comment.findById(
            req.params.id
        )

        if (!comment) {
            return res.status(404).json({
                message: "Comment not found"
            })
        }

        if (
            comment.user.toString() !==
            req.user.id.toString()
        ) {
            return res.status(403).json({
                message:
                    "You can only edit your own comment"
            })
        }

        const text = req.body.text

        if (!text || !text.trim()) {
            return res.status(400).json({
                message: "Comment cannot be empty"
            })
        }

        comment.text = text.trim()

        await comment.save()

        const result = await Comment.findById(
            comment._id
        ).populate(
            "user",
            "name email profilePicture"
        )

        res.json(result)

    } catch (error) {
        console.error(
            "Update comment error:",
            error
        )

        res.status(500).json({
            message: "Failed to update comment"
        })
    }
}


export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(
            req.params.id
        )

        if (!comment) {
            return res.status(404).json({
                message: "Comment not found"
            })
        }

        if (
            comment.user.toString() !==
            req.user.id.toString()
        ) {
            return res.status(403).json({
                message:
                    "You can only delete your own comment"
            })
        }

        await Comment.findByIdAndDelete(
            req.params.id
        )

        res.json({
            message:
                "Comment deleted successfully"
        })

    } catch (error) {
        console.error(
            "Delete comment error:",
            error
        )

        res.status(500).json({
            message:
                "Failed to delete comment"
        })
    }
}