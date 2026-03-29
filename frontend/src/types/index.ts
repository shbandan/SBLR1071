export interface Borrower {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export interface DashboardBorrowerRow extends Borrower {
  loan_count: number;
  pending_requests: number;
  collected_requests: number;
}

export interface DashboardBorrowersPage {
  items: DashboardBorrowerRow[];
  has_more: boolean;
  next_cursor?: string;
}

export interface DashboardSummaryMetric {
  completed: number;
  total: number;
}

export interface DashboardSummary {
  borrowers: DashboardSummaryMetric;
  loans: DashboardSummaryMetric;
}

export interface DashboardResponseTrendPoint {
  quarter_label: string;
  average_response_days: number | null;
  submitted_count: number;
}

export interface DashboardResponseTrend {
  points: DashboardResponseTrendPoint[];
}

export interface LoanData {
  id: string;
  borrower_id: string;
  loan_amount: number;
  loan_date: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  line_of_business: string;
  product_type: string;
  loan_purpose: string;
  interest_rate: number;
  created_at: string;
}

export interface Form1071Request {
  id: string;
  guid: string;
  loan_id: string;
  borrower_id: string;
  status: 'pending' | 'submitted' | 'inactive';
  request_sent_at: string;
  submitted_at?: string;
  created_at: string;
}

export interface Form1071Data {
  id: string;
  request_id: string;
  applicant_name: string;
  applicant_email: string;
  co_applicant_name?: string;
  co_applicant_email?: string;
  annual_income: number;
  liquid_assets: number;
  employment_status: string;
  credit_score_range: string;
  military_status: string;
  veteran_status: string;
  demographic_race: string;
  demographic_ethnicity: string;
  demographic_sex: string;
  demographic_age_range: string;
  created_at: string;
  updated_at: string;
}

export interface Form1071SubmissionHistoryItem extends Form1071Data {
  request_guid: string;
  request_status: 'pending' | 'submitted' | 'inactive';
  request_sent_at: string;
  submitted_at?: string;
}

export interface LoanWithRequest extends LoanData {
  request?: Form1071Request;
  submitted_data?: Form1071Data;
}
