import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { useAuthQueries } from "../features/auth/auth.queries";
import { LoginRequest, LoginResponse } from "../features/auth/auth.schema";

interface DecodedToken {
  role: "ADMIN" | "OWNER" | "CUSTOMER";
  sub: string;
  email: string;
}

function getSafeReturnTo(role: DecodedToken["role"]) {
  if (typeof window === "undefined") return null;

  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;

  // Marketplace discovery is public and safe for every authenticated role.
  if (candidate === "/customer/cars" || candidate.startsWith("/customer/cars/")) return candidate;

  if (role === "CUSTOMER" && candidate.startsWith("/customer/")) return candidate;
  if (role === "OWNER" && candidate.startsWith("/owner/")) return candidate;
  if (role === "ADMIN" && candidate.startsWith("/admin/")) return candidate;

  return null;
}

export const useAuth = () => {
  const router = useRouter();
  const authQueries = useAuthQueries();

  const handleAuthSuccess = (token: string) => {
    Cookies.set("token", token, { expires: 7, path: "/" });

    const decoded = jwtDecode<DecodedToken>(token);
    const returnTo = getSafeReturnTo(decoded.role);

    toast.success("Signed in successfully");

    if (returnTo) {
      router.push(returnTo);
    } else if (decoded.role === "ADMIN") {
      router.push("/admin/kyc");
    } else if (decoded.role === "OWNER") {
      router.push("/owner/cars");
    } else {
      router.push("/customer/cars");
    }

    router.refresh();
  };

  const handleLogin = (formData: LoginRequest) => {
    authQueries.login.mutate(formData, {
      onSuccess: (res: LoginResponse) => {
        const token = res.data?.token;
        if (token) handleAuthSuccess(token);
      },
      onError: (err: any) => {
        const message = err.response?.data?.message;
        toast.error(typeof message === "string" ? message : "Unable to sign in with those credentials");
      },
    });
  };

  const handleVerifyLoginOtp = (data: { email: string; code: string }) => {
    authQueries.otp.verify.login.mutate(data, {
      onSuccess: (res: any) => {
        const token = res.data?.token;
        if (token) handleAuthSuccess(token);
      },
      onError: (err: any) => {
        const message = err.response?.data?.message;
        toast.error(typeof message === "string" ? message : "The verification code is invalid or has expired");
      },
    });
  };

  const handleLogout = () => {
    Cookies.remove("token");
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  return {
    login: handleLogin,
    verifyLoginOtp: handleVerifyLoginOtp,
    logout: handleLogout,
    register: authQueries.register.mutate,
    resetPassword: authQueries.resetPassword.mutate,

    sendOtp: authQueries.otp.send,
    verifyOtp: authQueries.otp.verify,

    registerLoading: authQueries.register.isPending,
    verifyRegisterOtpLoading: authQueries.otp.verify.register.isPending,
    sendOtpRegisterLoading: authQueries.otp.send.register.isPending,

    isLoading: authQueries.login.isPending || authQueries.otp.verify.login.isPending,
    isOtpLoading:
      authQueries.otp.send.login.isPending ||
      authQueries.otp.send.register.isPending ||
      authQueries.otp.send.forgot.isPending,
  };
};
