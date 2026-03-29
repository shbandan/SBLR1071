# Architecture - SBLR 1071 Data Collection System

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Borrower                             │
│                                                             │
│  1. Receives email with form link                          │
│  2. Clicks link: /form1071/{GUID}                          │
│  3. Fills form with loan & personal data                   │
│  4. Submits form                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/REST
                       │
    ┌──────────────────▼──────────────────┐
    │      React Frontend (Port 3000)     │
    │                                     │
    │  - Dashboard                        │
    │    * List borrowers & loans         │
    │    * Show 1071 collection status    │
    │    * Trigger email requests         │
    │                                     │
    │  - 1071 Form Page                   │
    │    * Display form                   │
    │    * Submit data                    │
    │                                     │
    │  - API Service Layer                │
    │    * axios client                   │
    │    * Request/response handling      │
    └──────────────────┬──────────────────┘
                       │
                       │ HTTP/REST (Port 8000)
                       │
    ┌──────────────────▼──────────────────┐
    │     FastAPI Backend (Port 8000)     │
    │                                     │
    │  Routers:                           │
    │  - GET /borrowers                   │
    │  - GET /loans                       │
    │  - POST /1071-requests              │
    │  - POST /1071-submissions           │
    │                                     │
    │  Services:                          │
    │  - Email sender (SMTP)              │
    │  - Database ORM (SQLAlchemy)        │
    │  - Data validation (Pydantic)       │
    │                                     │
    │  Models:                            │
    │  - BorrowerModel                    │
    │  - LoanModel                        │
    │  - Form1071RequestModel             │
    │  - Form1071SubmissionModel          │
    └──────────────────┬──────────────────┘
                       │
                       │ SQL (Port 5432)
                       │
    ┌──────────────────▼──────────────────┐
    │    PostgreSQL Database              │
    │                                     │
    │  Tables:                            │
    │  - borrowers                        │
    │  - loans                            │
    │  - form_1071_requests               │
    │  - form_1071_submissions            │
    │                                     │
    │  Indexes:                           │
    │  - borrowers(email)                 │
    │  - loans(borrower_id)               │
    │  - requests(guid, loan_id)          │
    │  - submissions(request_id)          │
    └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     SMTP Server                             │
│           (Email: request link sent to borrower)            │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Create Collection Request (Lender Action)

```
Lender clicks "Collect 1071"
        ↓
Frontend POST /1071-requests
    {
      loan_id: "l001",
      borrower_email: "john@example.com"
    }
        ↓
Backend creates Form1071RequestModel
    - Generates GUID (unique)
    - Sets status = "pending"
    - Records request_sent_at
        ↓
Backend sends SMTP email
    - To: borrower_email
    - Link: http://app.example.com/form1071/{GUID}
        ↓
Return request object with GUID
        ↓
Frontend displays success message
```

### 2. Submit Form (Borrower Action)

```
Borrower clicks email link
        ↓
Frontend GET /form1071/{GUID}
        ↓
Backend GET /1071-requests/{GUID}
    - Validates GUID exists
    - Returns request & loan details
        ↓
Frontend displays pre-filled form
    - Loan info (read-only):
      * Loan amount, date, property
      * Purpose, interest rate
    
    - Empty 1071 fields (editable):
      * Applicant info
      * Financial data
      * Demographics
        ↓
Borrower fills form, clicks Submit
        ↓
Frontend POST /1071-submissions
    {
      request_id: "req-uuid",
      applicant_name: "...",
      applicant_email: "...",
      ...
    }
        ↓
Backend validates:
    - Request exists
    - Not already submitted
        ↓
Backend creates Form1071SubmissionModel
    - Saves all submitted data
        ↓
Backend updates Form1071RequestModel
    - Sets status = "submitted"
    - Records submitted_at timestamp
        ↓
Return success response
        ↓
Frontend redirects to Dashboard
```

### 3. View Status (Lender Action)

```
Lender refreshes Dashboard
        ↓
Frontend GET /loans?borrower_id=b001
        ↓
Backend joins loans with latest request
    - Loan.request = Form1071RequestModel
    - Shows submission if exists
        ↓
Frontend displays status:
    
    If request.status == "submitted":
    ├─ Show "Collected" badge
    ├─ Show submitted_at timestamp
    └─ Show "View Form" link
    
    If request.status == "pending":
    ├─ Show "Pending" badge
    ├─ Show request_sent_at timestamp
    └─ Disable "Collect 1071" button
    
    If no request:
    ├─ Show "Not Collected" badge
    └─ Enable "Collect 1071" button
```

## Component Architecture

### Frontend (React + Vite)

**Directory Structure:**
```
frontend/src/
├── pages/
│   ├── Dashboard.tsx      ← Lender view
│   └── Form1071.tsx       ← Borrower view
├── components/            ← Reusable (future)
├── services/
│   └── api.ts             ← API client (Axios)
├── types/
│   └── index.ts           ← TypeScript interfaces
├── App.tsx                ← Router setup
├── App.css                ← Global styles
└── main.tsx               ← Entry point
```

### Backend (FastAPI)

**Architecture** (monolithic - can split later):
```
backend/
├── main.py
│   ├── SQLAlchemy Models
│   ├── Pydantic Schemas
│   ├── API Routes
│   └── Database Dependency
└── email_service.py
```

### Database (PostgreSQL)

- 4 main tables with proper indexing
- Foreign key relationships
- Unique constraints for data integrity
