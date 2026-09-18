import mongoose from "mongoose"
import { GridFSBucket, ObjectId } from "mongodb"

let mediaBucket

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp"
    const connection = await mongoose.connect(uri)

    mediaBucket = new GridFSBucket(connection.connection.db, {
      bucketName: "media"
    })

    console.log("MongoDB connected successfully")
  } catch (error) {
    console.error("MongoDB connection failed:", error.message)
    process.exit(1)
  }
}

export function getMediaBucket() {
  return mediaBucket
}

export async function saveMedia(buffer, filename, contentType, metadata = {}) {
  return new Promise((resolve, reject) => {
    if (!mediaBucket) {
      return reject(new Error("GridFS media bucket not initialized"))
    }

    const uploadStream = mediaBucket.openUploadStream(filename, {
      contentType,
      metadata
    })

    uploadStream.on("error", reject)
    uploadStream.on("finish", () => {
      resolve(uploadStream.id.toString())
    })

    uploadStream.end(buffer)
  })
}

export async function getMedia(fileId) {
  if (!ObjectId.isValid(fileId)) return null

  const id = new ObjectId(fileId)
  const files = await mongoose.connection.db
    .collection("media.files")
    .find({ _id: id })
    .toArray()

  if (!files.length) return null
  return files[0]
}

export async function deleteMedia(fileId) {
  if (!ObjectId.isValid(fileId) || !mediaBucket) return

  const id = new ObjectId(fileId)
  try {
    await mediaBucket.delete(id)
  } catch (error) {
    console.error("Error deleting media:", error.message)
  }
}