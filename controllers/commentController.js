import Comment from "../models/Comment.js";
import Post from "../models/Post.js";

export const createComment = async (req, res) => {
    try {
        const post =
            await Post.findById(
                req.params.postId
            );

        if (!post) {
            return res.status(404).json({
                message: "Post not found"
            });
        }

        const text =
            String(
                req.body.text || ""
            ).trim();

        if (!text) {
            return res.status(400).json({
                message: "Comment cannot be empty"
            });
        }

        if (text.length > 2000) {
            return res.status(400).json({
                message: "Comment is too long"
            });
        }

        const comment =
            await Comment.create({
                post: post._id,
                author: req.user._id,
                text
            });

        const populatedComment =
            await Comment.findById(
                comment._id
            ).populate(
                "author",
                "name email profilePicture"
            );

        res.status(201).json({
            message: "Comment created",
            comment: populatedComment
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create comment"
        });
    }
};


export const getComments = async (req, res) => {
    try {
        const comments =
            await Comment.find({
                post: req.params.postId
            })
                .populate(
                    "author",
                    "name email profilePicture"
                )
                .sort({
                    createdAt: 1
                });

        res.json(comments);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to load comments"
        });
    }
};


export const updateComment = async (req, res) => {
    try {
        const comment =
            await Comment.findById(
                req.params.id
            );

        if (!comment) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        if (
            comment.author.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "You can only edit your own comment"
            });
        }

        const text =
            String(
                req.body.text || ""
            ).trim();

        if (!text) {
            return res.status(400).json({
                message: "Comment cannot be empty"
            });
        }

        comment.text = text;

        await comment.save();

        const updatedComment =
            await Comment.findById(
                comment._id
            ).populate(
                "author",
                "name email profilePicture"
            );

        res.json({
            message: "Comment updated",
            comment: updatedComment
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update comment"
        });
    }
};


export const deleteComment = async (req, res) => {
    try {
        const comment =
            await Comment.findById(
                req.params.id
            );

        if (!comment) {
            return res.status(404).json({
                message: "Comment not found"
            });
        }

        if (
            comment.author.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "You can only delete your own comment"
            });
        }

        await Comment.findByIdAndDelete(
            comment._id
        );

        res.json({
            message: "Comment deleted"
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete comment"
        });
    }
};