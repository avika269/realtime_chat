import { saveMedia, getMedia, getMediaBucket, deleteMedia as removeMedia } from "../config/db.js"

export async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    const mediaId = await saveMedia(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { uploadedBy: req.user._id.toString() }
    )

    res.json({
      message: "File uploaded",
      mediaId,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Media upload failed" })
  }
}

export async function streamMedia(req, res) {
  try {
    const file = await getMedia(req.params.id)

    if (!file) {
      return res.status(404).json({ message: "File not found" })
    }

    res.setHeader("Content-Type", file.contentType || "application/octet-stream")

    const bucket = getMediaBucket()
    const stream = bucket.openDownloadStream(file._id)

    stream.on("error", () => {
      res.status(404).end()
    })

    stream.pipe(res)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to load media" })
  }
}

export async function deleteMediaFile(req, res) {
  try {
    await removeMedia(req.params.id)
    res.json({ message: "Media deleted" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to delete media" })
  }
}