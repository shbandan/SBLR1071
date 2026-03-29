import { Borrower, LoanWithRequest } from '../types';
import { fmtAZ, fmtDate } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

/**
 * Download a proper .xlsx file with 2 tabs:
 *   Tab 1 – Borrowers
 *   Tab 2 – Loans (with all 1071 request + submission + audit fields)
 */
export function downloadExcel(
  borrowers: Borrower[],
  loansMap: Record<string, LoanWithRequest[]>,
  filename: string = 'CFPB1071_Data.xlsx'
): void {
  const workbook = XLSX.utils.book_new();

  /* ── Tab 1: Borrowers ───────────────────────────────────────────── */
  const borrowerRows = borrowers.map((b) => ({
    'Borrower ID':  b.id,
    'First Name':   b.first_name,
    'Last Name':    b.last_name,
    'Email':        b.email,
    'Created At':   fmtAZ(b.created_at, 'MM/DD/YYYY HH:mm:ss') + ' MST',
  }));

  const borrowerSheet = XLSX.utils.json_to_sheet(borrowerRows);
  XLSX.utils.book_append_sheet(workbook, borrowerSheet, 'Borrowers');

  /* ── Tab 2: Loans ───────────────────────────────────────────────── */
  const loanRows: Record<string, string | number>[] = [];

  borrowers.forEach((borrower) => {
    const loans = loansMap[borrower.id] || [];
    loans.forEach((loan) => {
      const req  = loan.request;
      const sub  = loan.submitted_data;

      loanRows.push({
        /* Loan core fields */
        'Loan ID':               loan.id,
        'Borrower ID':           loan.borrower_id,
        'Borrower Name':         `${borrower.first_name} ${borrower.last_name}`,
        'Borrower Email':        borrower.email,
        'Loan Amount ($)':       loan.loan_amount,
        'Loan Date':             fmtDate(loan.loan_date),
        'Property Address':      loan.property_address,
        'Property City':         loan.property_city,
        'Property State':        loan.property_state,
        'Property ZIP':          loan.property_zip,
        'Loan Purpose':          loan.loan_purpose,
        'Interest Rate (%)':     loan.interest_rate,
        'Loan Created At':       fmtAZ(loan.created_at, 'MM/DD/YYYY HH:mm:ss') + ' MST',

        /* 1071 Request fields */
        '1071 Request ID':       req?.id || '',
        '1071 GUID':             req?.guid || '',
        '1071 Status':           req?.status || 'Not Initiated',
        '1071 Sent At':          fmtAZ(req?.request_sent_at, 'MM/DD/YYYY HH:mm:ss') + (req?.request_sent_at ? ' MST' : ''),
        '1071 Submitted At':     fmtAZ(req?.submitted_at, 'MM/DD/YYYY HH:mm:ss') + (req?.submitted_at ? ' MST' : ''),
        '1071 Request Created':  fmtAZ(req?.created_at, 'MM/DD/YYYY HH:mm:ss') + (req?.created_at ? ' MST' : ''),

        /* 1071 Submission – Applicant */
        'Applicant Name':        sub?.applicant_name        || '',
        'Applicant Email':       sub?.applicant_email       || '',
        'Co-Applicant Name':     sub?.co_applicant_name     || '',
        'Co-Applicant Email':    sub?.co_applicant_email    || '',

        /* 1071 Submission – Financial */
        'Annual Income ($)':     sub?.annual_income  ?? '',
        'Liquid Assets ($)':     sub?.liquid_assets  ?? '',
        'Employment Status':     sub?.employment_status     || '',
        'Credit Score Range':    sub?.credit_score_range    || '',

        /* 1071 Submission – Military */
        'Military Status':       sub?.military_status       || '',
        'Veteran Status':        sub?.veteran_status        || '',

        /* 1071 Submission – Demographics */
        'Race/Ethnicity':        sub?.demographic_race      || '',
        'Ethnicity Detail':      sub?.demographic_ethnicity || '',
        'Sex':                   sub?.demographic_sex       || '',
        'Age Range':             sub?.demographic_age_range || '',

        /* 1071 Submission – Audit */
        '1071 Submission ID':    sub?.id                    || '',
        '1071 Data Collected At': fmtAZ(sub?.created_at, 'MM/DD/YYYY HH:mm:ss') + (sub?.created_at ? ' MST' : ''),
        '1071 Data Updated At':  fmtAZ(sub?.updated_at, 'MM/DD/YYYY HH:mm:ss') + (sub?.updated_at ? ' MST' : ''),
      });
    });
  });

  const loanSheet = XLSX.utils.json_to_sheet(loanRows);
  XLSX.utils.book_append_sheet(workbook, loanSheet, 'Loans');

  /* ── Download ───────────────────────────────────────────────────── */
  XLSX.writeFile(workbook, filename);
}

