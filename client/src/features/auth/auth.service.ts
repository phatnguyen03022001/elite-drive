import axios from "@/lib/axios";
import {
  EmailSchema,
  ForgotPasswordInput,
  ForgotPasswordSchema,
  LoginRequest,
  LoginRequestSchema,
  LoginResponse,
  LoginResponseSchema,
  OtpSchema,
  RegisterPasswordBody,
} from "./auth.schema";

export const authService = {
  login: async (payload: LoginRequest): Promise<LoginResponse> => {
    const validatedPayload = LoginRequestSchema.parse(payload);
    const res = await axios.post("/api/auth/login", validatedPayload);
    return LoginResponseSchema.parse(res);
  },

  logout: async () => axios.post("/api/auth/logout"),

  register: async (data: RegisterPasswordBody) =>
    axios.post("/api/auth/register", data),

  resetPassword: async (data: ForgotPasswordInput) => {
    ForgotPasswordSchema.parse(data);
    return axios.post("/api/auth/forgot-password", data);
  },

  otp: {
    send: {
      register: (email: string) => {
        EmailSchema.parse({ email });
        return axios.post("/api/auth/otp/register", { email });
      },
      login: (email: string) => {
        EmailSchema.parse({ email });
        return axios.post("/api/auth/otp/login", { email });
      },
      forgot: (email: string) => {
        EmailSchema.parse({ email });
        return axios.post("/api/auth/otp/forgot-password", { email });
      },
    },
    verify: {
      register: (email: string, code: string) => {
        OtpSchema.parse({ email, code });
        return axios.post("/api/auth/verify-register-otp", { email, code });
      },
      login: async (email: string, code: string): Promise<LoginResponse> => {
        OtpSchema.parse({ email, code });
        const res = await axios.post("/api/auth/verify-login-otp", { email, code });
        return LoginResponseSchema.parse(res);
      },
      forgot: (email: string, code: string) => {
        OtpSchema.parse({ email, code });
        return axios.post("/api/auth/verify-forgot-otp", { email, code });
      },
    },
  },

  getProfile: () => axios.get("/api/auth/me"),
};
