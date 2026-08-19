import { useRouter } from "next/navigation";
import { useAuthQueries } from "../features/auth/auth.queries";
import { LoginRequest } from "../features/auth/auth.schema";
import { authService } from "../features/auth/auth.service";
import { notify, notifyError } from "@/lib/notifications";

type Role = "ADMIN" | "OWNER" | "CUSTOMER";

function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "OWNER" || value === "CUSTOMER";
}

function getSafeReturnTo(role: Role) {
  if (typeof window === "undefined") return null;

  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;

  if (candidate === "/customer/cars" || candidate.startsWith("/customer/cars/")) return candidate;
  if (role === "CUSTOMER" && candidate.startsWith("/customer/")) return candidate;
  if (role === "OWNER" && candidate.startsWith("/owner/")) return candidate;
  if (role === "ADMIN" && candidate.startsWith("/admin/")) return candidate;

  return null;
}

export const useAuth = () => {
  const router = useRouter();
  const authQueries = useAuthQueries();

  const handleAuthSuccess = async () => {
    const session = await authService.getProfile();
    const role = session?.role;
    if (!isRole(role)) {
      throw new Error("Authenticated session returned an unsupported role");
    }

    const returnTo = getSafeReturnTo(role);
    notify.success("Signed in", {
      id: "auth-session",
      description: returnTo ? "Returning you to where you left off." : "Your Elite Drive workspace is ready.",
    });

    if (returnTo) {
      router.push(returnTo);
    } else if (role === "ADMIN") {
      router.push("/admin/kyc");
    } else if (role === "OWNER") {
      router.push("/owner/dashboard");
    } else {
      router.push("/customer/cars");
    }

    router.refresh();
  };

  const handleLogin = (formData: LoginRequest) => {
    authQueries.login.mutate(formData, {
      onSuccess: async () => {
        try {
          await handleAuthSuccess();
        } catch (error) {
          notifyError(
            "Session verification failed",
            error,
            "Your credentials were accepted, but the new session could not be verified. Sign in again.",
            { id: "auth-session" },
          );
          router.push("/login");
          router.refresh();
        }
      },
      onError: (error: unknown) => {
        notifyError(
          "Sign-in failed",
          error,
          "Check your email and password, then try again.",
          { id: "auth-sign-in" },
        );
      },
    });
  };

  const handleVerifyLoginOtp = (data: { email: string; code: string }) => {
    authQueries.otp.verify.login.mutate(data, {
      onSuccess: async () => {
        try {
          await handleAuthSuccess();
        } catch (error) {
          notifyError(
            "Session verification failed",
            error,
            "The code was accepted, but the new session could not be verified. Sign in again.",
            { id: "auth-session" },
          );
          router.push("/login");
          router.refresh();
        }
      },
      onError: (error: unknown) => {
        notifyError(
          "Verification code not accepted",
          error,
          "The code may be invalid or expired. Request a new code and try again.",
          { id: "auth-otp" },
        );
      },
    });
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      notify.info("Signed out", {
        id: "auth-session",
        description: "This browser no longer has an active Elite Drive session.",
      });
      router.push("/login");
      router.refresh();
    }
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
