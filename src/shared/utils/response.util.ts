export const ApiResponse = {
  success<T>(data: T, message?: string) {
    return { success: true as const, data, message: message ?? "OK" };
  },
  error(error: string, code?: number) {
    return { success: false as const, error, code };
  },
};
