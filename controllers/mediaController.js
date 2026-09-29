import multer from "multer"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = multer.memoryStorage()

export const upload = multer({
    storage
})

export const uploadMedia = async (req, res) => {
    try {

      cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded"
            })
        }

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "realtime_chat",
                    resource_type: "auto"
                },
                (error, result) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(result)
                    }
                }
            )

            stream.end(req.file.buffer)
        })

        res.status(201).json({
            message: "Media uploaded successfully",
            url: result.secure_url,
            public_id: result.public_id,
            resource_type: result.resource_type
        })
    } catch (error) {
        console.error("Cloudinary upload error:", error)

        res.status(500).json({
            message: error.message
        })
    }
}

export const deleteMedia = async (req, res) => {
    try {
        const { public_id, resource_type = "image" } = req.body

        if (!public_id) {
            return res.status(400).json({
                message: "public_id is required"
            })
        }

        const result = await cloudinary.uploader.destroy(
            public_id,
            {
                resource_type
            }
        )

        res.json({
            message: "Media deleted successfully",
            result: result.result
        })
    } catch (error) {
        console.error("Cloudinary delete error:", error)

        res.status(500).json({
            message: error.message
        })
    }
}