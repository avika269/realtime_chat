import fs from "fs"
import path from "path"
import multer from "multer"

const uploadDir = path.join(process.cwd(), "uploads")

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        const name = Date.now() + "-" + file.originalname.replace(/\s+/g, "-")
        cb(null, name)
    }
})

export const upload = multer({ storage })

export const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded"
            })
        }

        res.status(201).json({
            message: "Media uploaded successfully",
            filename: req.file.filename,
            url: `/uploads/${req.file.filename}`
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const deleteMedia = async (req, res) => {
    try {
        const filePath = path.join(uploadDir, req.params.filename)

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }

        res.json({
            message: "Media deleted successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}