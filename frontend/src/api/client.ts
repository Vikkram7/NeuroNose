import axios, { AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export interface ApiErrorResponse {
  message: string;
  status?: number;
  timestamp?: string;
  details?: Record<string, unknown>;
}

// Interceptor to transform errors into user-friendly message strings
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    let errorMessage = 'An unexpected network error occurred';

    if (error.response) {
      // Backend returned an error response
      errorMessage =
        error.response.data?.message ||
        error.response.data?.error ||
        `Request failed with status code ${error.response.status}`;
    } else if (error.request) {
      // Request made but no response (server offline or proxy connection refused)
      errorMessage = 'Backend service is currently unreachable. Check if the server is running.';
    } else {
      errorMessage = error.message;
    }

    const enhancedError = new Error(errorMessage);
    (enhancedError as unknown as { status?: number; code?: string }).status = error.response?.status;
    (enhancedError as unknown as { status?: number; code?: string }).code = error.code;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;
