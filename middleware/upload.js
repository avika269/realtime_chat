import multer from "multer"
import path from "path"
import fs from "fs"

const uploadDirectory = path.join(
    process.cwd(),
    "uploads"
)

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory)
    },

    filename: (req, file, cb) => {
        const extension =
            path.extname(file.originalname)

        const filename =
            `${Date.now()}-${Math.random()
                .toString(36)
                .substring(2)}${extension}`

        cb(null, filename)
    }
})

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/webm",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg"
    ]

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(
            new Error(
                "File type is not supported"
            ),
            false
        )
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
})

export default upload