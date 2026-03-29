# SBLR 1071 End-to-End Testing Suite

Comprehensive Playwright-based testing framework covering all 3 layers of the SBLR 1071 application: Frontend, API/Backend, and Database.

## Project Structure

```
testing/
├── e2e/                          # Test specifications
│   ├── api-health.spec.ts       # Health check and basic API tests
│   ├── api-borrowers.spec.ts    # Borrower CRUD operations
│   ├── api-loans.spec.ts        # Loan management tests
│   ├── api-1071-requests.spec.ts # 1071 request workflow tests
│   ├── api-1071-submissions.spec.ts # Form submission tests
│   ├── database-integrity.spec.ts   # Database schema and integrity
│   ├── frontend-ui.spec.ts      # Frontend UI and responsiveness
│   └── frontend-form-workflow.spec.ts # E2E form submission workflows
├── fixtures/                     # Test data
│   └── test-data.ts             # Reusable test data and endpoints
├── utils/                        # Test utilities
│   ├── api-client.ts            # HTTP client for API testing
│   └── db-client.ts             # PostgreSQL client for DB testing
├── package.json                 # Dependencies and scripts
├── playwright.config.ts         # Playwright configuration
└── README.md                    # This file
```

## Installation

```bash
cd testing

# Install dependencies
npm install
```

## Configuration

The test suite uses environment variables for configuration:

```bash
# Frontend URL (default: http://localhost:3000)
FRONTEND_URL=http://localhost:3000

# API URL (default: http://localhost:8000)
API_URL=http://localhost:8000

# Database Configuration
DB_USER=sband
DB_PASSWORD=admin
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sblr1071_v2
```

## Running Tests

### All Tests
```bash
npm test
```

### UI Mode (Interactive)
```bash
npm run test:ui
```

### Debug Mode
```bash
npm run test:debug
```

### Headed Mode (See browser)
```bash
npm run test:headed
```

### By Category

#### Frontend Tests Only
```bash
npm run test:frontend
```

#### API Tests Only
```bash
npm run test:api
```

#### Database Tests Only
```bash
npm run test:database
```

### By Tag

#### Smoke Tests (Quick verification)
```bash
npm run test:smoke
```

#### Critical Path Tests (Core functionality)
```bash
npm run test:critical
```

### Generate Report
```bash
npm run report
```

## Test Coverage

### 3-Layer Architecture Testing

#### Layer 1: Frontend (UI)
- Dashboard page loading and responsiveness
- Form 1071 page navigation
- Form input handling and validation
- Error boundary and error handling
- Performance metrics
- Mobile/tablet responsiveness
- E2E form submission workflows

**Files:** `frontend-ui.spec.ts`, `frontend-form-workflow.spec.ts`

#### Layer 2: Backend API
- Health check endpoint
- Borrower CRUD operations (Create, Read, Update, Delete)
- Loan management and retrieval
- Form 1071 requests (creation, resending, status management)
- Form 1071 submissions (creation, validation)
- Request/response validation
- Error handling and edge cases

**Files:** `api-health.spec.ts`, `api-borrowers.spec.ts`, `api-loans.spec.ts`, `api-1071-requests.spec.ts`, `api-1071-submissions.spec.ts`

#### Layer 3: Database
- Table structure verification
- Schema integrity checks
- Primary key constraints
- Foreign key relationships and referential integrity
- Index verification for performance
- Data consistency across tables
- Orphaned record detection
- Unique constraint verification (GUID, email handling)

**Files:** `database-integrity.spec.ts`

## Test Tags

Tests are tagged with keywords for easy filtering:

- `@smoke` - Quick smoke tests (basic functionality)
- `@critical` - Critical path tests (essential workflows)

## Key Features

✅ **Cross-browser Testing** - Runs on Chromium, Firefox, and WebKit
✅ **Database Testing** - Direct PostgreSQL integration for data verification
✅ **API Testing** - Comprehensive REST API endpoint testing
✅ **UI Testing** - Frontend form and page interaction testing
✅ **Data Fixtures** - Reusable test data with consistent patterns
✅ **Error Handling** - Tests for error scenarios and edge cases
✅ **Performance** - Load time and responsiveness tests
✅ **Responsive Design** - Mobile, tablet, and desktop viewport tests
✅ **HTML Reports** - Detailed test execution reports
✅ **Trace Viewing** - Debug traces on failed tests

## Utility Classes

### ApiClient (`utils/api-client.ts`)
HTTP client for testing API endpoints with GET, POST, PUT, DELETE methods.

```typescript
import { apiClient } from '../utils/api-client';

const response = await apiClient.get('/borrowers');
const created = await apiClient.post('/borrowers', borrowerData);
```

### DatabaseClient (`utils/db-client.ts`)
PostgreSQL client for direct database queries and verification.

```typescript
import { dbClient, dbQueries } from '../utils/db-client';

await dbClient.connect();
const count = await dbQueries.getBorrowerCount();
const borrower = await dbQueries.getBorrowerByEmail('test@example.com');
```

## Test Data Fixtures (`fixtures/test-data.ts`)
Pre-defined test data objects for consistent test scenarios.

```typescript
import { testData, apiEndpoints } from '../fixtures/test-data';

// Use predefined test data
const borrower = testData.borrower1;
const loan = testData.loan1;
const endpoint = apiEndpoints.borrowers;
```

## Troubleshooting

### Backend Not Starting
- Ensure Python virtual environment is activated
- Check DATABASE_URL environment variable
- Verify PostgreSQL is running

### Frontend Not Starting
- Ensure Node.js dependencies are installed
- Check npm run dev works manually
- Verify port 3000 is not in use

### Database Connection Failed
- Verify PostgreSQL is running
- Check database credentials in environment
- Ensure sblr1071_v2 database exists

### Tests Timing Out
- Increase timeout values in playwright.config.ts
- Check if services are running properly
- Verify network connectivity

## CI/CD Integration

The test suite is configured for CI/CD environments:

```bash
# Run tests in CI mode
CI=true npm test
```

In CI mode:
- Tests run with 2 retries
- Tests run sequentially (single worker)
- Detailed HTML reports are generated

## Best Practices

1. **Use Test Fixtures** - Leverage `testData` and `apiEndpoints` for consistency
2. **Tag Tests Appropriately** - Use @smoke and @critical tags for filtering
3. **Isolate Tests** - Each test should be independent and clean up after itself
4. **Use Setup/Teardown** - Leverage `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
5. **Test Edge Cases** - Include negative tests and error scenarios
6. **Document Tests** - Use clear test names and descriptions
7. **Keep Tests Fast** - Avoid unnecessary waits; use proper synchronization

## Maintenance

- Update test data in `fixtures/test-data.ts` when API contracts change
- Update endpoints in `fixtures/test-data.ts` when routes change
- Keep Playwright and dependencies updated: `npm update`
- Review and fix flaky tests regularly
- Archive reports periodically to manage disk space
