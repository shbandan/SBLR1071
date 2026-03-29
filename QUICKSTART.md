# Quick Start Guide - SBLR 1071 Data Collection System

## 5-Minute Setup (Development)

### Step 1: PostgreSQL Database
```bash
# Create database
createdb sblr1071

# Load schema (from project root)
psql -d sblr1071 -f database/schema.sql

# Load sample data (optional, for testing)
psql -d sblr1071 -f database/seed.sql
```

### Step 2: Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env (copy from .env.example)
cp .env.example .env

# Run server
python main.py

# Check it's running: http://localhost:8000/docs
```

### Step 3: Frontend Setup (New Terminal)
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser: http://localhost:3000
```

## Testing the Application

1. **Dashboard**
   - Navigate to http://localhost:3000
   - See 3 sample borrowers: John Doe, Jane Smith, Bob Johnson
   - Click "View Loans" to expand borrower
   - See 1-2 loans per borrower

2. **Create 1071 Request**
   - Click "Collect 1071" button
   - Email output will show in backend terminal
   - Copy the GUID from output

3. **Submit 1071 Form**
   - Open the form link manually: `http://localhost:3000/form1071/{GUID}`
   - Or in backend, the form URL will be logged
   - Fill in the form fields
   - Click "Submit Form"

4. **Verify in Dashboard**
   - Back to dashboard
   - Refresh page
   - Loan status should show "Collected" with timestamp
   - "View Form" link should appear

## Database reset (development)
```bash
dropdb sblr1071
createdb sblr1071
psql -d sblr1071 -f database/schema.sql
psql -d sblr1071 -f database/seed.sql
```

## Email Configuration (Production)

### Gmail (Recommended for Testing)
1. Enable 2-Factor Authentication on Gmail
2. Create App Password: https://myaccount.google.com/apppasswords
3. Set in .env:
```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-email@gmail.com
SENDER_PASSWORD=your-16-char-app-password
```

### Production SMTP
Update .env with your organization's SMTP settings:
```
SMTP_SERVER=mail.company.com
SMTP_PORT=587
SENDER_EMAIL=noreply@company.com
SENDER_PASSWORD=your-password
```

## Troubleshooting

### "Connection refused" on backend
- Check PostgreSQL is running: `psql -l`
- Check DATABASE_URL in .env is correct
- Restart backend

### Frontend can't reach backend
- Check backend is running on 8000: `curl http://localhost:8000/health`
- Check CORS is enabled (it is in main.py)
- Check proxy in vite.config.ts points to :8000

### Email not sending
- For dev, check backend console for email output
- For production, check SMTP credentials
- Test with: `telnet mail.example.com 587`

### 404 on form link
- Check GUID is correct
- Check backend database has the request
- SQL: `SELECT * FROM form_1071_requests;`

## Next Steps

1. **Add Authentication**
   - Protect Dashboard with lender login
   - Add borrower verification for form

2. **Customize Email**
   - Update HTML template in email_service.py
   - Add company logo/branding
   - Customize sender address

3. **Add More Fields**
   - Update schema.sql with new columns
   - Update Form1071SubmissionModel in main.py
   - Update form fields in Form1071.tsx
   - Update form schema in Pydantic

4. **Deploy**
   - Frontend: Vercel, Netlify, or S3+CloudFront
   - Backend: Heroku, AWS Lambda, ECS, or own server
   - Database: AWS RDS, Google Cloud SQL, or managed provider

5. **Monitoring**
   - Add logging to backend
   - Set up error tracking (Sentry)
   - Monitor database performance
   - Track email delivery

## Project Structure

```
SBLR1071/
├── frontend/              # React app
│   ├── src/
│   │   ├── pages/        # Dashboard, Form1071
│   │   ├── components/   # Future components
│   │   ├── services/     # API calls
│   │   ├── types/        # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── backend/              # FastAPI app
│   ├── main.py           # API routes & models
│   ├── email_service.py  # Email sending
│   ├── requirements.txt
│   └── .env.example
├── database/             # SQL scripts
│   ├── schema.sql        # Tables & indexes
│   └── seed.sql          # Sample data
├── README.md            # Full documentation
└── QUICKSTART.md        # This file
```

## Support

For issues or questions:
1. Check the README.md for detailed docs
2. Review error messages in console/logs
3. Check API docs at http://localhost:8000/docs
4. Review code comments in source files
