-- Database schema for CFPB 1071 Data Collection System

CREATE TABLE IF NOT EXISTS borrowers (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(36) PRIMARY KEY,
    borrower_id VARCHAR(36) NOT NULL REFERENCES borrowers(id),
    loan_amount DECIMAL(15,2) NOT NULL,
    loan_date TIMESTAMP NOT NULL,
    property_address VARCHAR(255) NOT NULL,
    property_city VARCHAR(100) NOT NULL,
    property_state VARCHAR(2) NOT NULL,
    property_zip VARCHAR(10) NOT NULL,
    line_of_business VARCHAR(100) DEFAULT 'Commercial Banking',
    product_type VARCHAR(100) DEFAULT 'Term Loan',
    loan_purpose VARCHAR(100) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_1071_requests (
    id VARCHAR(36) PRIMARY KEY,
    guid VARCHAR(36) UNIQUE NOT NULL,
    loan_id VARCHAR(36) NOT NULL REFERENCES loans(id),
    borrower_id VARCHAR(36) NOT NULL REFERENCES borrowers(id),
    status VARCHAR(20) DEFAULT 'pending',
    request_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_1071_submissions (
    id VARCHAR(36) PRIMARY KEY,
    request_id VARCHAR(36) NOT NULL UNIQUE REFERENCES form_1071_requests(id),
    applicant_name VARCHAR(255) NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    co_applicant_name VARCHAR(255),
    co_applicant_email VARCHAR(255),
    annual_income INTEGER,
    liquid_assets INTEGER,
    employment_status VARCHAR(50),
    credit_score_range VARCHAR(50),
    military_status VARCHAR(50),
    veteran_status VARCHAR(50),
    demographic_race VARCHAR(50),
    demographic_ethnicity VARCHAR(100),
    demographic_sex VARCHAR(50),
    demographic_age_range VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_borrowers_email ON borrowers(email);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_form_1071_requests_guid ON form_1071_requests(guid);
CREATE INDEX IF NOT EXISTS idx_form_1071_requests_loan_id ON form_1071_requests(loan_id);
CREATE INDEX IF NOT EXISTS idx_form_1071_submissions_request_id ON form_1071_submissions(request_id);
