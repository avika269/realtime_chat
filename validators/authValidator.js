const { z } = require("zod")

const collegeEmailValidator = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email({ message: "Invalid email format" })
  .refine(
    (email) => email.endsWith("@akgec.ac.in"),
    {
      message: "Only @akgec.ac.in college email addresses are allowed"
    }
  )

const registerSchema = z.object({
  username: z
    .string({ required_error: "Username is required" })
    .trim()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(30, { message: "Username cannot exceed 30 characters" }),
  email: collegeEmailValidator,
  password: z
    .string({ required_error: "Password is required" })
    .min(6, { message: "Password must be at least 6 characters long" })
})

const loginSchema = z.object({
  email: collegeEmailValidator,
  password: z
    .string({ required_error: "Password is required" })
    .min(1, { message: "Password is required" })
})

const googleAuthSchema = z.object({
  credential: z
    .string({ required_error: "Google credential token is required" })
    .min(10, { message: "Invalid credential token" })
})

module.exports = {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  collegeEmailValidator
}