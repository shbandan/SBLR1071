/**
 * API Client utility for testing backend endpoints
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:8000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      return { data: data as T, status: response.status };
    } catch (error) {
      return { error: String(error), status: 500 };
    }
  }

  async post<T>(endpoint: string, payload: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return { data: data as T, status: response.status };
    } catch (error) {
      return { error: String(error), status: 500 };
    }
  }

  async put<T>(endpoint: string, payload: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return { data: data as T, status: response.status };
    } catch (error) {
      return { error: String(error), status: 500 };
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      return { data: data as T, status: response.status };
    } catch (error) {
      return { error: String(error), status: 500 };
    }
  }
}

export const apiClient = new ApiClient();
