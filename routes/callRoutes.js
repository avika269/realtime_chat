import express from "express"

import {
    createCall,
    getCalls,
    updateCall,
    deleteCall
} from "../controllers/callController.js"

import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.post(
    "/",
    authenticate,
    createCall
)

router.get(
    "/",
    authenticate,
    getCalls
)

router.patch(
    "/:callId",
    authenticate,
    updateCall
)

router.delete(
    "/:callId",
    authenticate,
    deleteCall
)

export default router