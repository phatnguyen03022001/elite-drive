"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OtpForm } from "@/features/auth/components/OtpForm";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://elitedrive-demoversion.onrender.com";

const useVerifyRegisterOtp = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await axios.post(`${API_URL}/api/auth/otp/register`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Xác thực đăng ký thành công!");
      router.push("/auth/login");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Lỗi xác thực OTP");
    },
  });
};

const useVerifyLoginOtp = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await axios.post(`${API_URL}/api/auth/otp/login`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Đăng nhập thành công!");
      router.push("/dashboard");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "OTP không chính xác");
    },
  });
};

const useVerifyForgotOtp = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await axios.post(`${API_URL}/api/auth/otp/forgot-password`, payload);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Xác thực thành công. Hãy đặt lại mật khẩu!");
      router.push(`/auth/reset-password?email=${data.email}&token=${data.token}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Lỗi xác thực");
    },
  });
};

export default function OtpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const verifyRegisterOtp = useVerifyRegisterOtp();
  const verifyLoginOtp = useVerifyLoginOtp();
  const verifyForgotOtp = useVerifyForgotOtp();

  const type = searchParams.get("type") as "register" | "login" | "forgot" | null;
  const email = searchParams.get("email");

  if (!type || !email || !["register", "login", "forgot"].includes(type)) {
    router.replace("/auth/login");
    return null;
  }

  const verifyOtp = type === "register" ? verifyRegisterOtp : type === "login" ? verifyLoginOtp : verifyForgotOtp;
  const titles = {
    register: "Xác thực đăng ký",
    login: "Xác thực đăng nhập",
    forgot: "Xác thực đặt lại mật khẩu",
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">{titles[type]}</CardTitle>
        <CardDescription className="text-center">
          Mã OTP đã được gửi đến <strong>{email}</strong>
        </CardDescription>
      </CardHeader>
      <OtpForm email={email} onVerify={(payload) => verifyOtp.mutate(payload)} isLoading={verifyOtp.isPending} />
    </Card>
  );
}
