import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create({
  // Browser requests stay on the Elite Drive origin and are routed through /api.
  // This keeps backend host details out of client code and gives the app one
  // consistent transport contract across local and hosted environments.
  baseURL: "",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = Cookies.get("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error),
);

export default api;
