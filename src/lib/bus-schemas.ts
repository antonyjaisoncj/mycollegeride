import { z } from "zod";
import { EXPENSE_CATEGORIES } from "./fee-rules";

export const YEARS = ["First Year", "Second Year", "Third Year"] as const;
export const STAGES = ["Stage-1", "Stage-2", "Stage-3"] as const;

export const registrationSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number"),
  branch: z.string().trim().min(2, "Enter your branch").max(100),
  year_of_study: z.enum(YEARS, { message: "Select your year of study" }),
  stage: z.enum(STAGES, { message: "Select your stage" }),
  address: z.string().trim().min(5, "Enter your address").max(500),
  boarding_point: z.string().trim().min(2, "Enter your boarding point").max(120),
  guardian_name: z.string().trim().min(2, "Enter guardian name").max(100),
  guardian_phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number"),
  photo_path: z.string().trim().max(300).optional(),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");
const notFuture = (v: string) =>
  v <= new Date().toISOString().slice(0, 10) || "Date cannot be in the future";

export const approveSchema = z.object({
  id: z.string().uuid(),
  roll_number: z.string().trim().min(1, "Roll number is required").max(20),
  date_of_joining: isoDate.refine((v) => notFuture(v) === true, {
    message: "Date of joining cannot be in the future",
  }),
});

export const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});



const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const updateStudentSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2, "Enter the student's name").max(100),
  email: z
    .union([z.string().trim().email("Enter a valid email").max(255), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  phone: optionalText(15),
  branch: optionalText(100),
  year_of_study: z
    .union([z.enum(YEARS), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  stage: z.enum(STAGES),
  address: optionalText(500),
  boarding_point: optionalText(120),
  guardian_name: optionalText(100),
  guardian_phone: optionalText(15),
  roll_number: optionalText(20),
  photo_path: optionalText(300),
  date_of_joining: z
    .union([isoDate, z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type UpdateStudentInput = z.input<typeof updateStudentSchema>;

export const quickAddSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the student's name").max(100),
});

export const studentIdSchema = z.object({
  id: z.string().uuid(),
});

export const periodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const feeConfigSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lower_amount: z.number().positive().max(1000000),
  higher_amount: z.number().positive().max(1000000),
});

export const recordPaymentSchema = z.object({
  student_id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["cash", "upi", "bank"]),
  reference: z.string().trim().max(80).optional(),
});

export const expenseSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(EXPENSE_CATEGORIES),
  vendor: z.string().trim().min(2, "Enter vendor name").max(120),
  bill_no: z.string().trim().max(60).optional(),
  amount: z.number().positive("Enter an amount").max(10000000),
  notes: z.string().trim().max(500).optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const pickupOrderSchema = z.object({
  ids: z.array(z.string().uuid()).max(2000),
});

export const driverEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});
