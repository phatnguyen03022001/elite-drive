import axios from "axios";

const api = axios.create({
  // Browser requests stay on the Elite Drive origin and are routed through /api.
  // Authentication is carried by an HttpOnly cookie issued by the backend.
  baseURL: "",
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error),
);

export default api;
