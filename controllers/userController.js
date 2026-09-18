
import { User } from "../models/User.js"
import { Contact } from "../models/Contact.js"

export async function getUsers(req, res) {
  try {
    const search = req.query.search || ""

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    })
      .select("-password")
      .limit(50)

    res.json(users)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to load users" })
  }
}

export async function getUserById(req, res) {
  try {
    const user = await User.findById(req.params.id).select("-password")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to load user" })
  }
}

export async function blockUser(req, res) {
  try {
    const user = await User.findById(req.params.userId)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const alreadyBlocked = req.user.blockedUsers.some(
      id => id.toString() === user._id.toString()
    )

    if (!alreadyBlocked) {
      req.user.blockedUsers.push(user._id)
      await req.user.save()
    }

    res.json({ message: "User blocked" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to block user" })
  }
}

export async function unblockUser(req, res) {
  try {
    req.user.blockedUsers = req.user.blockedUsers.filter(
      id => id.toString() !== req.params.userId
    )

    await req.user.save()
    res.json({ message: "User unblocked" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to unblock user" })
  }
}

export async function addContact(req, res) {
  try {
    const user = await User.findById(req.params.userId)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const existingContact = await Contact.findOne({
      owner: req.user._id,
      contact: user._id
    })

    if (!existingContact) {
      await Contact.create({
        owner: req.user._id,
        contact: user._id
      })
    }

    res.json({ message: "Contact added" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to add contact" })
  }
}

export async function getContacts(req, res) {
  try {
    const contacts = await Contact.find({
      owner: req.user._id
    }).populate("contact", "-password")

    res.json(contacts)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Unable to load contacts" })
  }
}