from datetime import datetime, timedelta

from sqlalchemy import text

from main import (
    BorrowerModel,
    Form1071RequestModel,
    Form1071SubmissionModel,
    LoanModel,
    SessionLocal,
    engine,
    get_dashboard_summary,
)


TOTAL_BORROWERS = 100
LOANS_PER_BORROWER = 2
HARDCODED_BORROWER_EMAIL = "s.bandanatham@gmail.com"

TOTAL_LOANS = TOTAL_BORROWERS * LOANS_PER_BORROWER
MULTI_COLLECTION_LOAN_COUNT = int(TOTAL_LOANS * 0.30)  # 30% of loans

LATEST_SUBMITTED_LOANS = 130
LATEST_PENDING_LOANS = 50

FIRST_NAMES = [
    "Olivia", "Mason", "Ava", "Ethan", "Sophia", "Noah", "Isabella", "Liam", "Mia", "Lucas",
    "Charlotte", "Elijah", "Amelia", "James", "Harper", "Benjamin", "Evelyn", "Henry", "Abigail", "Jack",
]

LAST_NAMES = [
    "Parker", "Reed", "Lopez", "Cole", "Diaz", "Bennett", "Foster", "Hayes", "Morris", "Powell",
    "Ward", "Bryant", "Simmons", "Jenkins", "Ross", "Henderson", "Coleman", "Perry", "Butler", "Long",
]

CITIES = ["Phoenix", "Mesa", "Scottsdale", "Tempe", "Chandler", "Gilbert", "Glendale", "Peoria"]
LOAN_PURPOSES = ["Purchase", "Refinance", "Working Capital", "Equipment", "Expansion", "Startup"]
LINE_OF_BUSINESS = ["Commercial Banking", "Small Business Banking", "Equipment Finance", "Commercial Real Estate"]
PRODUCT_TYPES = ["Term Loan", "Business Line of Credit", "Equipment Loan", "Commercial Real Estate Loan", "Refinance Loan"]

QUARTER_RESPONSE_DAYS = [
    # Intentionally up/down to make the 24-month trend non-linear and realistic.
    [22, 20, 21, 23, 19, 18],
    [16, 15, 14, 17, 13, 12],
    [19, 18, 20, 17, 16, 15],
    [13, 12, 11, 10, 12, 9],
    [15, 16, 14, 13, 12, 11],
    [10, 9, 8, 11, 7, 8],
    [12, 11, 10, 9, 8, 7],
    [9, 8, 7, 6, 8, 5],
]


def quarter_start(reference: datetime, quarter_offset: int) -> datetime:
    current_quarter_month = ((reference.month - 1) // 3) * 3 + 1
    current_quarter_start = datetime(reference.year, current_quarter_month, 1, 9, 0, 0)
    total_months = (current_quarter_start.year * 12 + current_quarter_start.month - 1) + (quarter_offset * 3)
    year = total_months // 12
    month = total_months % 12 + 1
    return datetime(year, month, 1, 9, 0, 0)


def build_borrower_record(index: int) -> dict:
    return {
        "first_name": FIRST_NAMES[index % len(FIRST_NAMES)],
        "last_name": LAST_NAMES[(index * 3) % len(LAST_NAMES)],
        "email": HARDCODED_BORROWER_EMAIL,
    }


def build_loan_record(borrower_index: int, loan_index: int) -> dict:
    loan_sequence = borrower_index * LOANS_PER_BORROWER + loan_index
    city = CITIES[(borrower_index + loan_index) % len(CITIES)]
    return {
        "loan_amount": float(65000 + (borrower_index * 2750) + (loan_index * 18500)),
        "loan_date": datetime(
            2024 + (borrower_index % 2),
            (loan_sequence % 12) + 1,
            (loan_sequence % 27) + 1,
            10,
            0,
            0,
        ),
        "property_address": f"{400 + loan_sequence} Commerce Park Drive",
        "property_city": city,
        "property_state": "AZ",
        "property_zip": f"85{(loan_sequence % 90) + 10:03d}",
        "loan_purpose": LOAN_PURPOSES[loan_sequence % len(LOAN_PURPOSES)],
        "interest_rate": round(5.35 + ((loan_sequence % 9) * 0.18), 2),
        "line_of_business": LINE_OF_BUSINESS[loan_sequence % len(LINE_OF_BUSINESS)],
        "product_type": PRODUCT_TYPES[(loan_sequence + borrower_index) % len(PRODUCT_TYPES)],
    }


def create_submission_payload(borrower: BorrowerModel, sequence: int) -> dict:
    return {
        "applicant_name": f"{borrower.first_name} {borrower.last_name}",
        "applicant_email": borrower.email,
        "co_applicant_name": None,
        "co_applicant_email": None,
        "annual_income": 85000 + (sequence * 6000),
        "liquid_assets": 45000 + (sequence * 3500),
        "employment_status": "Employed",
        "credit_score_range": "720-759",
        "military_status": "No",
        "veteran_status": "No",
        "demographic_race": "Decline to answer",
        "demographic_ethnicity": "Decline to answer",
        "demographic_sex": "Decline to answer",
        "demographic_age_range": "35-44",
    }


def add_request(
    db,
    borrower: BorrowerModel,
    loan: LoanModel,
    request_sent_at: datetime,
    submitted_at: datetime | None,
    status: str,
    submission_sequence: int,
) -> None:
    request = Form1071RequestModel(
        loan_id=loan.id,
        borrower_id=borrower.id,
        status=status,
        request_sent_at=request_sent_at,
        submitted_at=submitted_at,
        created_at=request_sent_at,
    )
    db.add(request)
    db.flush()

    if status == "submitted" and submitted_at is not None:
        submission = Form1071SubmissionModel(
            request_id=request.id,
            created_at=submitted_at,
            updated_at=submitted_at,
            **create_submission_payload(borrower, submission_sequence),
        )
        db.add(submission)


def reset_and_seed() -> None:
    db = SessionLocal()
    try:
        print("Removing unique constraint from email column...")
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS borrowers_email_key"))
            print("Unique constraint removed")
        except Exception as exc:
            print(f"Note: Could not drop constraint (may not exist): {exc}")

        print("Truncating all existing records...")
        with engine.begin() as conn:
            conn.execute(
                text(
                    "TRUNCATE TABLE form_1071_submissions, form_1071_requests, loans, borrowers RESTART IDENTITY CASCADE"
                )
            )
        db.commit()
        print("Truncated all records successfully")

        borrowers: list[BorrowerModel] = []
        loans: list[LoanModel] = []

        for borrower_index in range(TOTAL_BORROWERS):
            borrower_data = build_borrower_record(borrower_index)
            borrower = BorrowerModel(
                first_name=borrower_data["first_name"],
                last_name=borrower_data["last_name"],
                email=borrower_data["email"],
            )
            db.add(borrower)
            db.flush()
            borrowers.append(borrower)

            for loan_index in range(LOANS_PER_BORROWER):
                loan_data = build_loan_record(borrower_index, loan_index)
                loan = LoanModel(
                    borrower_id=borrower.id,
                    loan_amount=loan_data["loan_amount"],
                    loan_date=loan_data["loan_date"],
                    property_address=loan_data["property_address"],
                    property_city=loan_data["property_city"],
                    property_state=loan_data["property_state"],
                    property_zip=loan_data["property_zip"],
                    loan_purpose=loan_data["loan_purpose"],
                    interest_rate=loan_data["interest_rate"],
                    line_of_business=loan_data["line_of_business"],
                    product_type=loan_data["product_type"],
                )
                db.add(loan)
                db.flush()
                loans.append(loan)

        now = datetime.utcnow().replace(microsecond=0)
        submission_sequence = 1

        # 30% of loans get multiple collections, capped to total 2..5 per loan after latest status insert.
        for loan_index in range(MULTI_COLLECTION_LOAN_COUNT):
            loan = loans[loan_index]
            borrower = borrowers[loan_index // LOANS_PER_BORROWER]
            historical_collection_count = 1 + (loan_index % 4)  # 1..4 historical + 1 latest = 2..5 total

            for collection_index in range(historical_collection_count):
                quarter_idx = (loan_index + collection_index) % len(QUARTER_RESPONSE_DAYS)
                quarter_begin = quarter_start(now, quarter_idx - 7)
                days_bucket = QUARTER_RESPONSE_DAYS[quarter_idx]
                response_days = days_bucket[(loan_index + (collection_index * 3)) % len(days_bucket)]
                sent_day_offset = 4 + ((loan_index + (collection_index * 5)) % 55)
                request_sent_at = quarter_begin + timedelta(days=sent_day_offset, hours=9 + (collection_index % 4))
                submitted_at = request_sent_at + timedelta(days=response_days, hours=2)

                add_request(
                    db,
                    borrower,
                    loan,
                    request_sent_at,
                    submitted_at,
                    "submitted",
                    submission_sequence,
                )
                submission_sequence += 1

        latest_submitted_loans = 0
        latest_pending_loans = 0

        for loan_index, loan in enumerate(loans):
            borrower = borrowers[loan_index // LOANS_PER_BORROWER]

            if loan_index < LATEST_SUBMITTED_LOANS:
                status = "submitted"
                response_days = 5 + (loan_index % 14)
            elif loan_index < (LATEST_SUBMITTED_LOANS + LATEST_PENDING_LOANS):
                status = "pending"
                response_days = None
            else:
                status = None
                response_days = None

            if status is None:
                continue

            quarter_idx = loan_index % len(QUARTER_RESPONSE_DAYS)
            quarter_begin = quarter_start(now, quarter_idx - 7)
            request_sent_at = quarter_begin + timedelta(days=10 + ((loan_index * 3) % 45), hours=11)
            submitted_at = None
            if status == "submitted" and response_days is not None:
                submitted_at = request_sent_at + timedelta(days=response_days, hours=2)
                latest_submitted_loans += 1
            else:
                latest_pending_loans += 1

            add_request(
                db,
                borrower,
                loan,
                request_sent_at,
                submitted_at,
                status,
                submission_sequence,
            )
            submission_sequence += 1

        db.commit()

        borrower_count = db.query(BorrowerModel).count()
        loan_count = db.query(LoanModel).count()
        no_request_loans = loan_count - latest_submitted_loans - latest_pending_loans
        summary = get_dashboard_summary(db)

        print("\n✓ Fresh graph-ready data seeded successfully!")
        print(f"  Borrowers: {borrower_count}")
        print(f"  Loans: {loan_count}")
        print(f"  Completed borrowers (latest submitted): {summary['borrowers']['completed']}")
        print(f"  Latest submitted loans: {latest_submitted_loans}")
        print(f"  Latest pending loans: {latest_pending_loans}")
        print(f"  Loans with no request: {no_request_loans}")
        print(f"  Borrower email (hardcoded): {HARDCODED_BORROWER_EMAIL}")
        print(f"  Loans with multiple collections (2-5 each): {MULTI_COLLECTION_LOAN_COUNT}")
        print("  Quarterly response trend: mixed up/down over the last 8 quarters")
        print("  Email sending: none, seeding writes database rows only")

    except Exception as exc:
        db.rollback()
        print(f"Error during reset: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    reset_and_seed()
