# CFPB 1071 Data Collection System

A full-stack application for managing CFPB 1071 data collection from borrowers. This system allows lenders to request 1071 data from borrowers via email, and borrowers to provide the information through a secure form.

## Architecture

```
┌─────────────────┐
│  React Frontend │ (Port 3000)
│  - Dashboard    │
│  - Form 1071    │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│  FastAPI Backend│ (Port 8000)
│  - Borrower APIs│
│  - Loan APIs    │
│  - Form APIs    │
│  - Email Svc    │
└────────┬────────┘
         │ SQL
         │
┌────────▼────────────┐
│  PostgreSQL DB      │
│  - Borrowers        │
│  - Loans            │
│  - 1071 Requests    │
│  - 1071 Submissions │
└─────────────────────┘
```

## Features

### Dashboard (Lender View)
- View list of borrowers with email addresses
- Drill down to view loans per borrower
- See 10 key loan data points:
  - Loan Amount
  - Loan Date
  - Property Address, City, State, Zip
  - Loan Purpose
  - Interest Rate
- View 1071 collection status:
  - "Not Collected" - no request sent
  - "Pending" - request sent at [timestamp]
  - "Collected" - submitted at [timestamp] + link to form
- Click "Collect 1071" button to:
  - Generate unique GUID for request
  - Send email to borrower with form link
  - Create request record in database

### 1071 Form (Borrower View)
- Pre-filled with loan information (read-only)
- Required fields:
  - Applicant Name
  - Applicant Email
- Optional financial info:
  - Co-applicant details
  - Annual Income
  - Liquid Assets
  - Employment Status
  - Credit Score Range
- Optional demographics:
  - Military Status
  - Veteran Status
  - Race/Ethnicity
  - Sex
  - Age Range
- Submit button (disabled if already submitted)
- Upon submission:
  - Data saved to database
  - Request status updated to "submitted"
  - Timestamp recorded

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool
- **React Router** - Navigation
- **Axios** - HTTP client
- **Day.js** - Date formatting

### Backend
- **FastAPI** - REST API framework
- **SQLAlchemy** - ORM
- **PostgreSQL** - Database
- **Pydantic** - Data validation
- **SMTP** - Email service

## Setup Instructions

### Prerequisites
- Node.js 16+
- Python 3.9+
- PostgreSQL 12+

### Database Setup

1. Create PostgreSQL database:
```bash
createdb sblr1071
```

2. Run schema:
```bash
psql -d sblr1071 -f database/schema.sql
```

3. (Optional) Load sample data:
```bash
psql -d sblr1071 -f database/seed.sql
```

### Backend Setup

1. Create virtual environment:
```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```
DATABASE_URL=postgresql://user:password@localhost/sblr1071
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-email@gmail.com
SENDER_PASSWORD=your-app-password
```

4. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Run development server:
```bash
npm run dev
```

The UI will be available at `http://localhost:3000`

## API Endpoints

### Borrowers
- `GET /borrowers` - List all borrowers
- `GET /borrowers/{id}` - Get borrower details

### Loans
- `GET /loans?borrower_id={id}` - Get loans for a borrower
- `GET /loans/{id}` - Get loan details with 1071 status

### 1071 Requests
- `POST /1071-requests` - Create new collection request
  - Sends email to borrower
  - Returns GUID for form URL
- `GET /1071-requests/{guid}` - Get request details

### 1071 Submissions
- `POST /1071-submissions` - Submit form data
  - Validates request exists
  - Prevents duplicate submissions
- `GET /1071-submissions/{request_id}` - Get submission data

## Business Flow

1. **Lender Action**
   - Logs into Dashboard
   - Browses borrowers and their loans
   - Click "Collect 1071" for borrower/loan

2. **System Action**
   - Generate unique GUID
   - Create request record (status: pending)
   - Send email to borrower with form link: `/form1071/{guid}`
   - Display success message

3. **Borrower Action**
   - Click link in email
   - Form loads with loan data pre-filled
   - Fill required and optional fields
   - Click Submit

4. **System Action**
   - Validate form data
   - Create submission record
   - Update request status to "submitted"
   - Record submission timestamp

5. **Lender Action**
   - Refresh Dashboard
   - See "Collected" status with timestamp
   - Click link to view submitted form data

## Email Template

The system sends an HTML email with:
- Salutation
- Explanation of data collection requirement
- Clickable button to form
- Plain text link as fallback
- Professional footer

Email sent to borrower's registered email address with unique form URL.

## Database Schema

### borrowers
- id (UUID)
- email (unique)
- first_name
- last_name
- created_at

### loans
- id (UUID)
- borrower_id (FK)
- loan_amount
- loan_date
- property_address, city, state, zip
- loan_purpose
- interest_rate
- created_at

### form_1071_requests
- id (UUID)
- guid (UUID, unique) - used in email link
- loan_id (FK)
- borrower_id (FK)
- status (pending|submitted)
- request_sent_at
- submitted_at
- created_at

### form_1071_submissions
- id (UUID)
- request_id (FK, unique)
- applicant_name, email
- co_applicant_name, email
- annual_income, liquid_assets
- employment_status, credit_score_range
- military_status, veteran_status
- demographic fields (race, ethnicity, sex, age_range)
- created_at, updated_at

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@host:port/dbname
SMTP_SERVER=smtp.example.com
SMTP_PORT=587
SENDER_EMAIL=noreply@company.com
SENDER_PASSWORD=your-app-specific-password
```

For development/testing, if SMTP_SERVER is "smtp.example.com", emails are logged to console instead of sent.

## Error Handling

- Invalid GUID: User sees "Form not found" message
- Already submitted: Shows read-only form with submitted status
- Database errors: Friendly error messages with retry option
- Network errors: Automatic retry with user notification

## Security Considerations

- GUID is unique and URL-safe (UUID v4)
- Forms can only be submitted once per request
- No authentication in this version (add per your org requirements)
- HTTPS recommended for production
- SMTP credentials should be in secure environment variables
- SQL injection protected via ORM (SQLAlchemy)
- CORS enabled for development (restrict for production)

## Development Notes

- Frontend proxy (vite.config.ts) routes /api calls to backend
- All timestamps in UTC
- Email sending is fault-tolerant (logs errors, doesn't block)
- Database migrations can be run from schema.sql
- Sample data in seed.sql for testing

## Future Enhancements

- User authentication (Lender login)
- Email verification for borrower
- Form timeout/expiration
- Workflow notifications
- Audit logging
- Data export/reporting
- Multi-language support
- Mobile app
