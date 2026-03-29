/**
 * Test data fixtures for consistent test scenarios
 */

export const testData = {
  borrower1: {
    email: 'test.borrower1@example.com',
    first_name: 'John',
    last_name: 'Doe',
  },
  borrower2: {
    email: 'test.borrower2@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
  },
  borrower3: {
    email: 'test.borrower3@example.com',
    first_name: 'Bob',
    last_name: 'Johnson',
  },
  loan1: {
    loan_amount: 250000,
    loan_date: '2024-01-15T00:00:00',
    property_address: '123 Main Street',
    property_city: 'New York',
    property_state: 'NY',
    property_zip: '10001',
    loan_purpose: 'Home Purchase',
    interest_rate: 6.5,
  },
  loan2: {
    loan_amount: 75000,
    loan_date: '2024-02-20T00:00:00',
    property_address: '456 Oak Avenue',
    property_city: 'Los Angeles',
    property_state: 'CA',
    property_zip: '90001',
    loan_purpose: 'Home Improvement',
    interest_rate: 7.0,
  },
  form1071Submission: {
    applicant_name: 'John Doe',
    applicant_email: 'john@example.com',
    co_applicant_name: 'Jane Doe',
    co_applicant_email: 'jane@example.com',
    annual_income: 150000,
    liquid_assets: 50000,
    employment_status: 'Employed',
    credit_score_range: '700-749',
    military_status: 'No',
    veteran_status: 'No',
    demographic_race: 'White',
    demographic_ethnicity: 'Not Hispanic or Latino',
    demographic_sex: 'Male',
    demographic_age_range: '35-44',
  },
};

export const apiEndpoints = {
  health: '/health',
  borrowers: '/borrowers',
  loans: '/loans',
  requests1071: '/1071-requests',
  submissions1071: '/1071-submissions',
};
