import { z } from "zod";

export const EmailSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export const OtpSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  code: z.string().regex(/^\d{6}$/, "Mã OTP phải gồm đúng 6 chữ số"),
});

export const LoginRequestSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128, "Mật khẩu quá dài"),
});

export const LoginResponseSchema = z
  .object({
    success: z.boolean().optional(),
    data: z.object({
      authenticated: z.literal(true),
    }),
  })
  .passthrough();

export const RegisterPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(72, "Mật khẩu tối đa 72 ký tự"),
  otp: z.string().regex(/^\d{6}$/).optional(),
  firstName: z.string().min(2, "Tên không được để trống").max(100),
  lastName: z.string().min(2, "Họ không được để trống").max(100),
  phone: z.string().regex(/^0\d{9}$/, "Số điện thoại không hợp lệ"),
  role: z.enum(["CUSTOMER", "OWNER"]).default("CUSTOMER"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  code: z.string().regex(/^\d{6}$/, "Mã OTP phải gồm đúng 6 chữ số"),
  newPassword: z.string().min(8, "Mật khẩu mới tối thiểu 8 ký tự").max(72, "Mật khẩu mới tối đa 72 ký tự"),
});

export const OtpLoginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  code: z.string().regex(/^\d{6}$/, "Mã OTP phải gồm đúng 6 chữ số"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type OtpLoginInput = z.infer<typeof OtpLoginSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RegisterPasswordBody = z.infer<typeof RegisterPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type SendOtpInput = z.infer<typeof EmailSchema>;
export type VerifyOtpInput = z.infer<typeof OtpSchema>;
