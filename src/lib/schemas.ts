import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const tallyConfigSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().min(1, "Port must be at least 1").max(65535, "Port must be at most 65535"),
});

export type TallyConfigValues = z.infer<typeof tallyConfigSchema>;

export const createUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  name: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "VIEWER"]),
  isActive: z.boolean().default(true),
  pageAccess: z.array(z.string()).default([]),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  name: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional().or(z.literal("")),
  password: z.string().optional(),
  role: z.enum(["ADMIN", "VIEWER"]),
  isActive: z.boolean(),
  pageAccess: z.array(z.string()),
});

export type EditUserValues = z.infer<typeof editUserSchema>;
