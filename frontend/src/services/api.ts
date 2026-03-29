import axios from 'axios';
import {
  Borrower,
  DashboardBorrowersPage,
  DashboardResponseTrend,
  DashboardSummary,
  LoanData,
  Form1071Request,
  Form1071Data,
  Form1071SubmissionHistoryItem,
  LoanWithRequest,
} from '../types';

const API_BASE = '/api';

const client = axios.create({
  baseURL: API_BASE,
});

type DashboardBorrowersQuery = {
  limit?: number;
  cursor?: string;
  q?: string;
};

// Suppress 404 errors for submission lookups (expected when form hasn't been submitted yet)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't log 404 errors on submission endpoint lookups
    if (error.config?.url?.includes('/1071-submissions/') && error.response?.status === 404) {
      return Promise.reject(error);
    }
    // Log other errors normally
    return Promise.reject(error);
  }
);

// Borrower APIs
export const borrowerAPI = {
  getAll: async (): Promise<Borrower[]> => {
    const res = await client.get('/borrowers');
    return res.data;
  },

  getById: async (id: string): Promise<Borrower> => {
    const res = await client.get(`/borrowers/${id}`);
    return res.data;
  },

  create: async (data: Partial<Borrower>): Promise<Borrower> => {
    const res = await client.post('/borrowers', data);
    return res.data;
  },

  update: async (id: string, data: Partial<Borrower>): Promise<Borrower> => {
    const res = await client.put(`/borrowers/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/borrowers/${id}`);
  },
};

export const dashboardAPI = {
  getBorrowers: async ({ limit = 100, cursor, q }: DashboardBorrowersQuery = {}): Promise<DashboardBorrowersPage> => {
    const res = await client.get('/dashboard/borrowers', {
      params: {
        limit,
        cursor,
        q,
      },
    });
    return res.data;
  },

  getSummary: async (): Promise<DashboardSummary> => {
    const res = await client.get('/dashboard/summary');
    return res.data;
  },

  getResponseTrend: async (): Promise<DashboardResponseTrend> => {
    const res = await client.get('/dashboard/response-trend');
    return res.data;
  },
};

// Loan APIs
export const loanAPI = {
  getByBorrowerId: async (borrowerId: string): Promise<LoanWithRequest[]> => {
    const res = await client.get(`/loans?borrower_id=${borrowerId}`);
    return res.data;
  },

  getById: async (id: string): Promise<LoanWithRequest> => {
    const res = await client.get(`/loans/${id}`);
    return res.data;
  },

  create: async (data: Partial<LoanData>): Promise<LoanData> => {
    const res = await client.post('/loans', data);
    return res.data;
  },

  update: async (id: string, data: Partial<LoanData>): Promise<LoanData> => {
    const res = await client.put(`/loans/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/loans/${id}`);
  },
};

// 1071 Request APIs
export const form1071API = {
  submitRequest: async (
    loanId: string,
    borrowerEmail: string
  ): Promise<Form1071Request> => {
    const res = await client.post('/1071-requests', {
      loan_id: loanId,
      borrower_email: borrowerEmail,
    });
    return res.data;
  },

  getByGuid: async (guid: string): Promise<Form1071Request> => {
    const res = await client.get(`/1071-requests/${guid}`);
    return res.data;
  },

  resendRequest: async (requestId: string): Promise<Form1071Request> => {
    const res = await client.put(`/1071-requests/${requestId}`);
    return res.data;
  },

  submitForm: async (
    requestId: string,
    data: Partial<Form1071Data>
  ): Promise<Form1071Data> => {
    const res = await client.post(`/1071-submissions`, {
      request_id: requestId,
      ...data,
    });
    return res.data;
  },

  getSubmission: async (requestId: string): Promise<Form1071Data | null> => {
    try {
      const res = await client.get(`/1071-submissions/${requestId}`);
      return res.data;
    } catch (error: any) {
      // 404 is expected for new forms that haven't been submitted yet
      if (error.response?.status === 404) {
        return null;
      }
      // Re-throw unexpected errors
      throw error;
    }
  },

  getLoanSubmissionsHistory: async (
    loanId: string
  ): Promise<Form1071SubmissionHistoryItem[]> => {
    const res = await client.get(`/loans/${loanId}/1071-submissions-history`);
    return res.data;
  },
};

export default {
  dashboardAPI,
  borrowerAPI,
  loanAPI,
  form1071API,
};
