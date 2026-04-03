from db_restore_utils import ensure_database_exists, get_database_url


def run_full_restore() -> None:
    database_url = get_database_url()
    db_name = ensure_database_exists(database_url)
    print(f"Database ready: {db_name}")

    from reset_fresh_data import reset_and_seed
    from main import BorrowerModel, Form1071RequestModel, Form1071SubmissionModel, LoanModel, SessionLocal

    reset_and_seed()

    db = SessionLocal()
    try:
        borrower_count = db.query(BorrowerModel).count()
        loan_count = db.query(LoanModel).count()
        request_count = db.query(Form1071RequestModel).count()
        submission_count = db.query(Form1071SubmissionModel).count()
    finally:
        db.close()

    print("\nFull DB restore completed.")
    print(f"  Database: {db_name}")
    print(f"  Borrowers: {borrower_count}")
    print(f"  Loans: {loan_count}")
    print(f"  1071 Requests: {request_count}")
    print(f"  1071 Submissions: {submission_count}")


if __name__ == "__main__":
    run_full_restore()
