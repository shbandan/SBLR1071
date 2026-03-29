from datetime import datetime

from main import BorrowerModel, LoanModel, SessionLocal


def upsert_borrower(db, email: str, first_name: str, last_name: str) -> BorrowerModel:
    borrower = db.query(BorrowerModel).filter(BorrowerModel.email == email).first()
    if borrower:
        borrower.first_name = first_name
        borrower.last_name = last_name
        return borrower

    borrower = BorrowerModel(
        email=email,
        first_name=first_name,
        last_name=last_name,
    )
    db.add(borrower)
    db.flush()
    return borrower


def ensure_loan(
    db,
    borrower_id: str,
    loan_amount: float,
    loan_date: datetime,
    property_address: str,
    property_city: str,
    property_state: str,
    property_zip: str,
    loan_purpose: str,
    interest_rate: float,
) -> LoanModel:
    loan = (
        db.query(LoanModel)
        .filter(
            LoanModel.borrower_id == borrower_id,
            LoanModel.property_address == property_address,
            LoanModel.loan_amount == loan_amount,
        )
        .first()
    )
    if loan:
        loan.loan_date = loan_date
        loan.property_city = property_city
        loan.property_state = property_state
        loan.property_zip = property_zip
        loan.loan_purpose = loan_purpose
        loan.interest_rate = interest_rate
        return loan

    loan = LoanModel(
        borrower_id=borrower_id,
        loan_amount=loan_amount,
        loan_date=loan_date,
        property_address=property_address,
        property_city=property_city,
        property_state=property_state,
        property_zip=property_zip,
        loan_purpose=loan_purpose,
        interest_rate=interest_rate,
    )
    db.add(loan)
    return loan


def seed() -> None:
    db = SessionLocal()
    try:
        borrowers = [
            {
                "email": "alex.carter@example.com",
                "first_name": "Alex",
                "last_name": "Carter",
                "loans": [
                    {
                        "loan_amount": 425000.0,
                        "loan_date": datetime(2026, 1, 10, 12, 0, 0),
                        "property_address": "1201 Palm Ave",
                        "property_city": "Phoenix",
                        "property_state": "AZ",
                        "property_zip": "85004",
                        "loan_purpose": "Purchase",
                        "interest_rate": 6.25,
                    },
                    {
                        "loan_amount": 180000.0,
                        "loan_date": datetime(2026, 2, 18, 12, 0, 0),
                        "property_address": "778 Desert Ridge Rd",
                        "property_city": "Scottsdale",
                        "property_state": "AZ",
                        "property_zip": "85255",
                        "loan_purpose": "Refinance",
                        "interest_rate": 5.95,
                    },
                ],
            },
            {
                "email": "maria.nguyen@example.com",
                "first_name": "Maria",
                "last_name": "Nguyen",
                "loans": [
                    {
                        "loan_amount": 96000.0,
                        "loan_date": datetime(2026, 1, 22, 12, 0, 0),
                        "property_address": "455 Commerce Blvd",
                        "property_city": "Tempe",
                        "property_state": "AZ",
                        "property_zip": "85281",
                        "loan_purpose": "Working Capital",
                        "interest_rate": 7.15,
                    }
                ],
            },
            {
                "email": "david.lopez@example.com",
                "first_name": "David",
                "last_name": "Lopez",
                "loans": [
                    {
                        "loan_amount": 250000.0,
                        "loan_date": datetime(2026, 3, 5, 12, 0, 0),
                        "property_address": "902 Canyon Way",
                        "property_city": "Mesa",
                        "property_state": "AZ",
                        "property_zip": "85202",
                        "loan_purpose": "Equipment",
                        "interest_rate": 6.8,
                    }
                ],
            },
        ]

        for entry in borrowers:
            borrower = upsert_borrower(
                db,
                email=entry["email"],
                first_name=entry["first_name"],
                last_name=entry["last_name"],
            )
            for loan_data in entry["loans"]:
                ensure_loan(db, borrower_id=borrower.id, **loan_data)

        db.commit()

        borrower_count = db.query(BorrowerModel).count()
        loan_count = db.query(LoanModel).count()
        print(f"Seed complete. Borrowers: {borrower_count}, Loans: {loan_count}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
