# API Examples - SBLR 1071

## Base URL
Development: `http://localhost:8000`

## Health Check
Check if backend is running:
```bash
curl http://localhost:8000/health
```
Response:
```json
{"status": "ok"}
```

## API Documentation
Interactive Swagger UI available at: `http://localhost:8000/docs`

---

## Borrower Endpoints

### Get All Borrowers
```bash
curl http://localhost:8000/borrowers
```

Response:
```json
[
  {
    "id": "b001",
    "email": "john.doe@email.com",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2024-03-27T10:00:00"
  },
  {
    "id": "b002",
    "email": "jane.smith@email.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "created_at": "2024-03-27T10:05:00"
  }
]
```

### Get Specific Borrower
```bash
curl http://localhost:8000/borrowers/b001
```

Response:
```json
{
  "id": "b001",
  "email": "john.doe@email.com",
  "first_name": "John",
  "last_name": "Doe",
  "created_at": "2024-03-27T10:00:00"
}
```

---

## Loan Endpoints

### Get All Loans for a Borrower
```bash
curl "http://localhost:8000/loans?borrower_id=b001"
```

Response:
```json
[
  {
    "id": "l001",
    "borrower_id": "b001",
    "loan_amount": 250000.00,
    "loan_date": "2024-01-15T00:00:00",
    "property_address": "123 Main Street",
    "property_city": "New York",
    "property_state": "NY",
    "property_zip": "10001",
    "loan_purpose": "Home Purchase",
    "interest_rate": 6.5,
    "created_at": "2024-03-27T10:00:00",
    "request": null,
    "submitted_data": null
  }
]
```

### Get Specific Loan with Status
```bash
curl http://localhost:8000/loans/l001
```

Response (with pending request):
```json
{
  "id": "l001",
  "borrower_id": "b001",
  "loan_amount": 250000.00,
  "loan_date": "2024-01-15T00:00:00",
  "property_address": "123 Main Street",
  "property_city": "New York",
  "property_state": "NY",
  "property_zip": "10001",
  "loan_purpose": "Home Purchase",
  "interest_rate": 6.5,
  "created_at": "2024-03-27T10:00:00",
  "request": {
    "id": "req-uuid",
    "guid": "guid-for-form-url",
    "loan_id": "l001",
    "borrower_id": "b001",
    "status": "pending",
    "request_sent_at": "2024-03-27T11:00:00",
    "submitted_at": null,
    "created_at": "2024-03-27T11:00:00"
  },
  "submitted_data": null
}
```

---

## 1071 Request Endpoints

### Create New Collection Request
Sends email to borrower with form link.

```bash
curl -X POST http://localhost:8000/1071-requests \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "l001",
    "borrower_email": "john.doe@email.com"
  }'
```

Request body:
```json
{
  "loan_id": "l001",
  "borrower_email": "john.doe@email.com"
}
```

Response:
```json
{
  "id": "req-uuid",
  "guid": "550e8400-e29b-41d4-a716-446655440000",
  "loan_id": "l001",
  "borrower_id": "b001",
  "status": "pending",
  "request_sent_at": "2024-03-27T11:00:00",
  "submitted_at": null,
  "created_at": "2024-03-27T11:00:00"
}
```

Form URL to send to borrower:
```
http://yoursite.com/form1071/550e8400-e29b-41d4-a716-446655440000
```

### Get Request Details
```bash
curl http://localhost:8000/1071-requests/{guid}
```

Response:
```json
{
  "id": "req-uuid",
  "guid": "550e8400-e29b-41d4-a716-446655440000",
  "loan_id": "l001",
  "borrower_id": "b001",
  "status": "pending",
  "request_sent_at": "2024-03-27T11:00:00",
  "submitted_at": null,
  "created_at": "2024-03-27T11:00:00"
}
```

---

## 1071 Submission Endpoints

### Submit Form Data
Borrower submits completed 1071 form.

```bash
curl -X POST http://localhost:8000/1071-submissions \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-uuid",
    "applicant_name": "John Doe",
    "applicant_email": "john.doe@email.com",
    "co_applicant_name": "Jane Doe",
    "co_applicant_email": "jane.doe@email.com",
    "annual_income": 150000,
    "liquid_assets": 50000,
    "employment_status": "employed",
    "credit_score_range": "740-799",
    "military_status": "not-applicable",
    "veteran_status": "not-veteran",
    "demographic_race": "white",
    "demographic_ethnicity": "",
    "demographic_sex": "male",
    "demographic_age_range": "35-44"
  }'
```

Request body:
```json
{
  "request_id": "req-uuid",
  "applicant_name": "John Doe",
  "applicant_email": "john.doe@email.com",
  "co_applicant_name": "Jane Doe",
  "co_applicant_email": "jane.doe@email.com",
  "annual_income": 150000,
  "liquid_assets": 50000,
  "employment_status": "employed",
  "credit_score_range": "740-799",
  "military_status": "not-applicable",
  "veteran_status": "not-veteran",
  "demographic_race": "white",
  "demographic_ethnicity": "",
  "demographic_sex": "male",
  "demographic_age_range": "35-44"
}
```

Response:
```json
{
  "id": "sub-uuid",
  "request_id": "req-uuid",
  "applicant_name": "John Doe",
  "applicant_email": "john.doe@email.com",
  "co_applicant_name": "Jane Doe",
  "co_applicant_email": "jane.doe@email.com",
  "annual_income": 150000,
  "liquid_assets": 50000,
  "employment_status": "employed",
  "credit_score_range": "740-799",
  "military_status": "not-applicable",
  "veteran_status": "not-veteran",
  "demographic_race": "white",
  "demographic_ethnicity": "",
  "demographic_sex": "male",
  "demographic_age_range": "35-44",
  "created_at": "2024-03-27T11:30:00",
  "updated_at": "2024-03-27T11:30:00"
}
```

### Get Submission Data
```bash
curl http://localhost:8000/1071-submissions/{request_id}
```

Response:
```json
{
  "id": "sub-uuid",
  "request_id": "req-uuid",
  "applicant_name": "John Doe",
  "applicant_email": "john.doe@email.com",
  "co_applicant_name": "Jane Doe",
  "co_applicant_email": "jane.doe@email.com",
  "annual_income": 150000,
  "liquid_assets": 50000,
  "employment_status": "employed",
  "credit_score_range": "740-799",
  "military_status": "not-applicable",
  "veteran_status": "not-veteran",
  "demographic_race": "white",
  "demographic_ethnicity": "",
  "demographic_sex": "male",
  "demographic_age_range": "35-44",
  "created_at": "2024-03-27T11:30:00",
  "updated_at": "2024-03-27T11:30:00"
}
```

---

## Error Responses

### 404 Not Found
```json
{
  "detail": "Borrower not found"
}
```

### 400 Bad Request
```json
{
  "detail": "Form already submitted for this request"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Complete Workflow Example

### 1. Get borrowers
```bash
curl http://localhost:8000/borrowers | jq '.[0]'
# Extract: id (b001), email (john.doe@email.com)
```

### 2. Get loans for borrower
```bash
curl "http://localhost:8000/loans?borrower_id=b001" | jq '.[0]'
# Extract: loan_id (l001)
```

### 3. Create 1071 request
```bash
curl -X POST http://localhost:8000/1071-requests \
  -H "Content-Type: application/json" \
  -d '{"loan_id": "l001", "borrower_email": "john.doe@email.com"}' | jq '.guid'
# Extract: guid (550e8400-e29b-41d4-a716-446655440000)
```

### 4. Share form link with borrower
```
http://app.example.com/form1071/550e8400-e29b-41d4-a716-446655440000
```

### 5. Borrower submits form
```bash
curl -X POST http://localhost:8000/1071-submissions \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-uuid",
    "applicant_name": "John Doe",
    "applicant_email": "john.doe@email.com",
    "annual_income": 150000,
    "credit_score_range": "740-799"
  }' | jq '.id'
```

### 6. Check loan status
```bash
curl "http://localhost:8000/loans/l001"
# Now shows: status = "submitted", submitted_at = timestamp
```

---

## Python Client Example

```python
import requests

BASE_URL = "http://localhost:8000"

# Get borrowers
response = requests.get(f"{BASE_URL}/borrowers")
borrowers = response.json()
print(borrowers)

# Create 1071 request
data = {
    "loan_id": "l001",
    "borrower_email": "john.doe@email.com"
}
response = requests.post(f"{BASE_URL}/1071-requests", json=data)
request_data = response.json()
print(f"Form URL: http://app.example.com/form1071/{request_data['guid']}")

# Submit form
submission_data = {
    "request_id": request_data["id"],
    "applicant_name": "John Doe",
    "applicant_email": "john.doe@email.com",
    "annual_income": 150000,
    "credit_score_range": "740-799"
}
response = requests.post(f"{BASE_URL}/1071-submissions", json=submission_data)
print(response.json())
```

---

## JavaScript/Fetch Example

```javascript
const BASE_URL = "http://localhost:8000";

// Get borrowers
fetch(`${BASE_URL}/borrowers`)
  .then(r => r.json())
  .then(borrowers => console.log(borrowers));

// Create 1071 request
fetch(`${BASE_URL}/1071-requests`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    loan_id: "l001",
    borrower_email: "john.doe@email.com"
  })
})
  .then(r => r.json())
  .then(data => console.log(`Form URL: http://app.example.com/form1071/${data.guid}`));
```
