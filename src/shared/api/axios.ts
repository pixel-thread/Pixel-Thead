import axios, { AxiosInstance, AxiosError } from "axios";
import { env } from "../config/env";

export const axiosClient: AxiosInstance = axios.create({
  baseURL: env.RAZORPAY_BASE_URL,
  auth: {
    username: env.RAZORPAY_KEY_ID,
    password: env.RAZORPAY_KEY_SECRET,
  },
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

axiosClient.interceptors.request.use((config) => {
  console.debug(`[Axios] -> ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const message =
      (error.response?.data as any)?.error?.description ?? error.message;
    console.error(`[Axios] Error ${status}: ${message}`);
    return Promise.reject(error);
  }
);
