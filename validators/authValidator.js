import { z } from "zod";

export const collegeEmailValidator = z
  .string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a string",
  })
  .trim()
  .toLowerCase()
  .email({ message: "Invalid email format" })
  .refine(
    (email) => email.toLowerCase().endsWith("@akgec.ac.in"),
    { message: "Only @akgec.ac.in college email addresses are allowed" }
  );

export const registerSchema = z.object({
  username: z
    .string({
      required_error: "Username is required",
      invalid_type_error: "Username must be a string",
    })
    .trim()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(30, { message: "Username cannot exceed 30 characters" }),
  email: collegeEmailValidator,
  password: z
    .string({
      required_error: "Password is required",
      invalid_type_error: "Password must be a string",
    })
    .min(6, { message: "Password must be at least 6 characters long" }),
});

export const loginSchema = z.object({
  email: collegeEmailValidator,
  password: z
    .string({
      required_error: "Password is required",
      invalid_type_error: "Password must be a string",
    })
    .min(1, { message: "Password is required" }),
});

export const googleAuthSchema = z.object({
  credential: z
    .string({
      required_error: "Google credential token is required",
      invalid_type_error: "Credential must be a string",
    })
    .min(10, { message: "Invalid credential token" }),
});

export default {
  collegeEmailValidator,
  registerSchema,
  loginSchema,
  googleAuthSchema,
};
