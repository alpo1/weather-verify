import { z } from "zod";

export const RegisterSchema = z.object({
    email: z.email("valid email is required").toLowerCase(),
    password: z
        .string()
        .min(8, "password must be at least 8 characters")
        .max(200, "password is too long"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
    email: z.email("valid email is required").toLowerCase(),
    password: z.string().min(1, "password is required"),
});