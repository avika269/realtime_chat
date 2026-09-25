import express from "express"

import {
    getContacts,
    searchContacts,
    getContact
} from "../controllers/contactController.js"

import { authenticate } from "../middleware/auth.js"

const router = express.Router()

router.get(
    "/",
    authenticate,
    getContacts
)

router.get(
    "/search",
    authenticate,
    searchContacts
)

router.get(
    "/:userId",
    authenticate,
    getContact
)

export default router