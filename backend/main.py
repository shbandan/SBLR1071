from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    and_,
    or_,
    func,
    case,
    cast,
    text as sql_text,
    inspect,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
import uuid
import os
import base64
from email_service import send_collection_email

try:
    import pyodbc as _odbc_module
except ModuleNotFoundError:
    import pypyodbc as _odbc_module

# Database Setup
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mssql+pyodbc://@localhost:1433/sblr1071_v2?driver=ODBC+Driver+18+for+SQL+Server&trusted_connection=yes&TrustServerCertificate=yes"
)

# Public URL of the frontend app — change this in production to your real hostname.
# e.g. "https://1071.wahbank.com" or the machine's LAN IP for local network access.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

if DATABASE_URL.startswith("mssql+pyodbc"):
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        future=True,
        pool_pre_ping=True,
        module=_odbc_module,
    )
else:
    engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    inspector = inspect(conn)
    return any(col.get("name") == column_name for col in inspector.get_columns(table_name))


def _index_exists(conn, table_name: str, index_name: str) -> bool:
    inspector = inspect(conn)
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))


def _ensure_loan_dimension_columns(conn) -> None:
    dialect = engine.dialect.name

    if not _column_exists(conn, "loans", "line_of_business"):
        if dialect == "mssql":
            conn.execute(sql_text("ALTER TABLE loans ADD line_of_business VARCHAR(100) NULL"))
        else:
            conn.execute(sql_text("ALTER TABLE loans ADD COLUMN line_of_business VARCHAR(100)"))

    if not _column_exists(conn, "loans", "product_type"):
        if dialect == "mssql":
            conn.execute(sql_text("ALTER TABLE loans ADD product_type VARCHAR(100) NULL"))
        else:
            conn.execute(sql_text("ALTER TABLE loans ADD COLUMN product_type VARCHAR(100)"))


def _ensure_index(conn, table_name: str, index_name: str, columns_sql: str) -> None:
    if _index_exists(conn, table_name, index_name):
        return
    conn.execute(sql_text(f"CREATE INDEX {index_name} ON {table_name} ({columns_sql})"))

# Database Models
class BorrowerModel(Base):
    __tablename__ = "borrowers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), index=True)  # Removed unique=True to allow multiple borrowers with same email
    first_name = Column(String(100))
    last_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class LoanModel(Base):
    __tablename__ = "loans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    borrower_id = Column(String(36), index=True)
    loan_amount = Column(Float)
    loan_date = Column(DateTime)
    property_address = Column(String(255))
    property_city = Column(String(100))
    property_state = Column(String(2))
    property_zip = Column(String(10))
    line_of_business = Column(String(100), default="Commercial Banking")
    product_type = Column(String(100), default="Term Loan")
    loan_purpose = Column(String(100))
    interest_rate = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class Form1071RequestModel(Base):
    __tablename__ = "form_1071_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    guid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    loan_id = Column(String(36), index=True)
    borrower_id = Column(String(36), index=True)
    status = Column(String(20), default="pending")  # pending, submitted
    request_sent_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Form1071SubmissionModel(Base):
    __tablename__ = "form_1071_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(36), index=True)
    applicant_name = Column(String(255))
    applicant_email = Column(String(255))
    co_applicant_name = Column(String(255), nullable=True)
    co_applicant_email = Column(String(255), nullable=True)
    annual_income = Column(Integer, nullable=True)
    liquid_assets = Column(Integer, nullable=True)
    employment_status = Column(String(50), nullable=True)
    credit_score_range = Column(String(50), nullable=True)
    military_status = Column(String(50), nullable=True)
    veteran_status = Column(String(50), nullable=True)
    demographic_race = Column(String(50), nullable=True)
    demographic_ethnicity = Column(String(100), nullable=True)
    demographic_sex = Column(String(50), nullable=True)
    demographic_age_range = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)




# Pydantic Schemas
class BorrowerSchema(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class LoanSchema(BaseModel):
    id: str
    borrower_id: str
    loan_amount: float
    loan_date: datetime
    property_address: str
    property_city: str
    property_state: str
    property_zip: str
    line_of_business: Optional[str] = None
    product_type: Optional[str] = None
    loan_purpose: str
    interest_rate: float
    created_at: datetime

    class Config:
        from_attributes = True


class Form1071RequestSchema(BaseModel):
    id: str
    guid: str
    loan_id: str
    borrower_id: str
    status: str
    request_sent_at: datetime
    submitted_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class Form1071RequestCreateSchema(BaseModel):
    loan_id: str
    borrower_email: str


class Form1071SubmissionSchema(BaseModel):
    id: str
    request_id: str
    applicant_name: str
    applicant_email: str
    co_applicant_name: Optional[str]
    co_applicant_email: Optional[str]
    annual_income: Optional[int]
    liquid_assets: Optional[int]
    employment_status: Optional[str]
    credit_score_range: Optional[str]
    military_status: Optional[str]
    veteran_status: Optional[str]
    demographic_race: Optional[str]
    demographic_ethnicity: Optional[str]
    demographic_sex: Optional[str]
    demographic_age_range: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Form1071SubmissionHistoryItemSchema(BaseModel):
    id: str
    request_id: str
    request_guid: str
    request_status: str
    request_sent_at: datetime
    submitted_at: Optional[datetime]
    applicant_name: str
    applicant_email: str
    co_applicant_name: Optional[str]
    co_applicant_email: Optional[str]
    annual_income: Optional[int]
    liquid_assets: Optional[int]
    employment_status: Optional[str]
    credit_score_range: Optional[str]
    military_status: Optional[str]
    veteran_status: Optional[str]
    demographic_race: Optional[str]
    demographic_ethnicity: Optional[str]
    demographic_sex: Optional[str]
    demographic_age_range: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Form1071SubmissionCreateSchema(BaseModel):
    request_id: str
    applicant_name: str
    applicant_email: str
    co_applicant_name: Optional[str] = None
    co_applicant_email: Optional[str] = None
    annual_income: Optional[int] = None
    liquid_assets: Optional[int] = None
    employment_status: Optional[str] = None
    credit_score_range: Optional[str] = None
    military_status: Optional[str] = None
    veteran_status: Optional[str] = None
    demographic_race: Optional[str] = None
    demographic_ethnicity: Optional[str] = None
    demographic_sex: Optional[str] = None
    demographic_age_range: Optional[str] = None


class LoanWithRequestSchema(LoanSchema):
    request: Optional[Form1071RequestSchema] = None
    submitted_data: Optional[Form1071SubmissionSchema] = None


class DashboardBorrowerRowSchema(BorrowerSchema):
    loan_count: int
    pending_requests: int
    collected_requests: int


class DashboardBorrowersPageSchema(BaseModel):
    items: List[DashboardBorrowerRowSchema]
    has_more: bool
    next_cursor: Optional[str]


class DashboardSummaryMetricSchema(BaseModel):
    completed: int
    total: int


class DashboardSummarySchema(BaseModel):
    borrowers: DashboardSummaryMetricSchema
    loans: DashboardSummaryMetricSchema


class DashboardResponseTrendPointSchema(BaseModel):
    quarter_label: str
    average_response_days: Optional[float]
    submitted_count: int


class DashboardResponseTrendSchema(BaseModel):
    points: List[DashboardResponseTrendPointSchema]


# Create tables (with error handling for startup)
try:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        # Lightweight schema migration for new loan dimensions.
        _ensure_loan_dimension_columns(conn)

        # Backfill all existing loan records with typical business dimensions.
        conn.execute(
            sql_text(
                """
                UPDATE loans
                SET
                    line_of_business = COALESCE(NULLIF(TRIM(line_of_business), ''),
                        CASE
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('equipment', 'equipment financing') THEN 'Equipment Finance'
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('working capital', 'startup', 'business') THEN 'Small Business Banking'
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('commercial', 'purchase', 'home purchase', 'investment') THEN 'Commercial Real Estate'
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('refinance', 'home improvement') THEN 'Commercial Banking'
                            ELSE 'Commercial Banking'
                        END
                    ),
                    product_type = COALESCE(NULLIF(TRIM(product_type), ''),
                        CASE
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('working capital', 'startup', 'business') THEN 'Business Line of Credit'
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('equipment', 'equipment financing') THEN 'Equipment Loan'
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('commercial', 'investment') THEN 'Commercial Real Estate Loan'
                            WHEN LOWER(COALESCE(loan_purpose, '')) IN ('refinance', 'home improvement') THEN 'Refinance Loan'
                            ELSE 'Term Loan'
                        END
                    )
                """
            )
        )

        # Dashboard performance indexes for pagination and typeahead search.
        _ensure_index(conn, "borrowers", "idx_borrowers_created_id", "created_at DESC, id DESC")
        _ensure_index(conn, "borrowers", "idx_borrowers_name", "first_name, last_name")
        _ensure_index(conn, "loans", "idx_loans_created", "created_at DESC")
        _ensure_index(conn, "loans", "idx_loans_amount", "loan_amount")
except Exception as e:
    print(f"Warning: Could not create tables at startup: {e}")
    print("Tables will be created on first request or when database is available")

# FastAPI app
app = FastAPI(title="SBLR 1071 API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def borrower_display_name(borrower: Optional[BorrowerModel]) -> str:
    """Return a clean display name for email greetings."""
    if not borrower:
        return "Borrower"
    first = (borrower.first_name or "").strip()
    last = (borrower.last_name or "").strip()
    full = f"{first} {last}".strip()
    return full if full else "Borrower"


def generate_unique_guid(db: Session) -> str:
    """Generate a GUID unique across all historical 1071 requests."""
    for _ in range(5):
        candidate = str(uuid.uuid4())
        exists = db.query(Form1071RequestModel).filter(
            Form1071RequestModel.guid == candidate
        ).first()
        if not exists:
            return candidate
    raise HTTPException(status_code=500, detail="Could not generate a unique form token. Please try again.")


def encode_dashboard_cursor(created_at: datetime, borrower_id: str) -> str:
    raw = f"{created_at.isoformat()}|{borrower_id}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")


def decode_dashboard_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        created_at_str, borrower_id = decoded.split("|", 1)
        return datetime.fromisoformat(created_at_str), borrower_id
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cursor")


def deactivate_requests_for_loan(db: Session, loan_id: str) -> None:
    """Mark all non-inactive requests for a loan as inactive."""
    active_requests = db.query(Form1071RequestModel).filter(
        Form1071RequestModel.loan_id == loan_id,
        Form1071RequestModel.status != "inactive",
    ).all()
    for req in active_requests:
        req.status = "inactive"


# Health Check
@app.get("/health")
def health_check():
    return {"status": "ok"}


# Borrower endpoints
@app.get("/dashboard/borrowers", response_model=DashboardBorrowersPageSchema)
def get_dashboard_borrowers(
    limit: int = 20,
    cursor: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    # Safety clamp to keep predictable query cost.
    page_size = max(1, min(limit, 100))

    latest_request_ts_sq = (
        db.query(
            Form1071RequestModel.loan_id.label("loan_id"),
            func.max(Form1071RequestModel.created_at).label("latest_created_at"),
        )
        .group_by(Form1071RequestModel.loan_id)
        .subquery()
    )

    latest_request_sq = (
        db.query(
            Form1071RequestModel.loan_id.label("loan_id"),
            Form1071RequestModel.status.label("status"),
            Form1071RequestModel.submitted_at.label("submitted_at"),
        )
        .join(
            latest_request_ts_sq,
            and_(
                Form1071RequestModel.loan_id == latest_request_ts_sq.c.loan_id,
                Form1071RequestModel.created_at == latest_request_ts_sq.c.latest_created_at,
            ),
        )
        .subquery()
    )

    query = (
        db.query(
            BorrowerModel.id,
            BorrowerModel.email,
            BorrowerModel.first_name,
            BorrowerModel.last_name,
            BorrowerModel.created_at,
            func.count(func.distinct(LoanModel.id)).label("loan_count"),
            func.coalesce(
                func.sum(case((latest_request_sq.c.status == "pending", 1), else_=0)),
                0,
            ).label("pending_requests"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                latest_request_sq.c.status == "submitted",
                                latest_request_sq.c.submitted_at.isnot(None),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("collected_requests"),
        )
        .outerjoin(LoanModel, LoanModel.borrower_id == BorrowerModel.id)
        .outerjoin(latest_request_sq, latest_request_sq.c.loan_id == LoanModel.id)
    )

    if q:
        query_text = q.strip()
        if query_text:
            like = f"%{query_text}%"
            matching_borrower_ids_sq = (
                db.query(LoanModel.borrower_id)
                .filter(
                    or_(
                        LoanModel.id.ilike(like),
                        cast(LoanModel.loan_amount, String).ilike(like),
                    )
                )
                .subquery()
            )

            query = query.filter(
                or_(
                    BorrowerModel.first_name.ilike(like),
                    BorrowerModel.last_name.ilike(like),
                    (BorrowerModel.first_name + " " + BorrowerModel.last_name).ilike(like),
                    BorrowerModel.email.ilike(like),
                    BorrowerModel.id.ilike(like),
                    BorrowerModel.id.in_(matching_borrower_ids_sq),
                )
            )

    if cursor:
        cursor_created_at, cursor_id = decode_dashboard_cursor(cursor)
        query = query.filter(
            or_(
                BorrowerModel.created_at < cursor_created_at,
                and_(
                    BorrowerModel.created_at == cursor_created_at,
                    BorrowerModel.id < cursor_id,
                ),
            )
        )

    rows = (
        query.group_by(
            BorrowerModel.id,
            BorrowerModel.email,
            BorrowerModel.first_name,
            BorrowerModel.last_name,
            BorrowerModel.created_at,
        )
        .order_by(BorrowerModel.created_at.desc(), BorrowerModel.id.desc())
        .limit(page_size + 1)
        .all()
    )

    has_more = len(rows) > page_size
    page_rows = rows[:page_size]

    items = [
        {
            "id": row.id,
            "email": row.email,
            "first_name": row.first_name,
            "last_name": row.last_name,
            "created_at": row.created_at,
            "loan_count": int(row.loan_count or 0),
            "pending_requests": int(row.pending_requests or 0),
            "collected_requests": int(row.collected_requests or 0),
        }
        for row in page_rows
    ]

    next_cursor = None
    if has_more and page_rows:
        last_row = page_rows[-1]
        next_cursor = encode_dashboard_cursor(last_row.created_at, last_row.id)

    return {
        "items": items,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }


@app.get("/dashboard/summary", response_model=DashboardSummarySchema)
def get_dashboard_summary(db: Session = Depends(get_db)):
    latest_request_ts_sq = (
        db.query(
            Form1071RequestModel.loan_id.label("loan_id"),
            func.max(Form1071RequestModel.created_at).label("latest_created_at"),
        )
        .group_by(Form1071RequestModel.loan_id)
        .subquery()
    )

    latest_request_sq = (
        db.query(
            Form1071RequestModel.loan_id.label("loan_id"),
            Form1071RequestModel.borrower_id.label("borrower_id"),
            Form1071RequestModel.status.label("status"),
            Form1071RequestModel.submitted_at.label("submitted_at"),
        )
        .join(
            latest_request_ts_sq,
            and_(
                Form1071RequestModel.loan_id == latest_request_ts_sq.c.loan_id,
                Form1071RequestModel.created_at == latest_request_ts_sq.c.latest_created_at,
            ),
        )
        .subquery()
    )

    completed_loans = int(
        db.query(func.count())
        .select_from(latest_request_sq)
        .filter(
            latest_request_sq.c.status == "submitted",
            latest_request_sq.c.submitted_at.isnot(None),
        )
        .scalar()
        or 0
    )

    completed_borrowers = int(
        db.query(func.count(func.distinct(latest_request_sq.c.borrower_id)))
        .filter(
            latest_request_sq.c.status == "submitted",
            latest_request_sq.c.submitted_at.isnot(None),
        )
        .scalar()
        or 0
    )

    total_borrowers = int(db.query(func.count(BorrowerModel.id)).scalar() or 0)
    total_loans = int(db.query(func.count(LoanModel.id)).scalar() or 0)

    return {
        "borrowers": {"completed": completed_borrowers, "total": total_borrowers},
        "loans": {"completed": completed_loans, "total": total_loans},
    }


@app.get("/dashboard/response-trend", response_model=DashboardResponseTrendSchema)
def get_dashboard_response_trend(db: Session = Depends(get_db)):
    current = datetime.utcnow()
    current_quarter_index = current.year * 4 + ((current.month - 1) // 3)
    quarter_starts = []
    for quarter_index in range(current_quarter_index - 7, current_quarter_index + 1):
        year = quarter_index // 4
        quarter_zero_based = quarter_index % 4
        quarter_starts.append(datetime(year, quarter_zero_based * 3 + 1, 1))

    oldest_quarter_start = quarter_starts[0]

    # Keep aggregation database-agnostic so both SQL Server and PostgreSQL work.
    submitted_rows = (
        db.query(Form1071RequestModel.request_sent_at, Form1071RequestModel.submitted_at)
        .filter(
            Form1071RequestModel.request_sent_at >= oldest_quarter_start,
            Form1071RequestModel.status == "submitted",
            Form1071RequestModel.submitted_at.isnot(None),
        )
        .all()
    )

    quarter_buckets = {quarter_start: [] for quarter_start in quarter_starts}
    for row in submitted_rows:
        if row.request_sent_at is None or row.submitted_at is None:
            continue

        sent_at = row.request_sent_at.replace(tzinfo=None)
        submitted_at = row.submitted_at.replace(tzinfo=None)
        quarter_start = datetime(sent_at.year, ((sent_at.month - 1) // 3) * 3 + 1, 1)

        if quarter_start not in quarter_buckets:
            continue

        response_days = (submitted_at - sent_at).total_seconds() / 86400.0
        quarter_buckets[quarter_start].append(response_days)

    points = []
    for quarter_start in quarter_starts:
        values = quarter_buckets.get(quarter_start, [])
        quarter_number = ((quarter_start.month - 1) // 3) + 1
        points.append(
            {
                "quarter_label": f"Q{quarter_number} {quarter_start.year % 100:02d}",
                "average_response_days": round(sum(values) / len(values), 1) if values else None,
                "submitted_count": len(values),
            }
        )

    return {"points": points}


@app.get("/borrowers", response_model=List[BorrowerSchema])
def get_borrowers(db: Session = Depends(get_db)):
    borrowers = db.query(BorrowerModel).all()
    return borrowers


@app.get("/borrowers/{borrower_id}", response_model=BorrowerSchema)
def get_borrower(borrower_id: str, db: Session = Depends(get_db)):
    borrower = db.query(BorrowerModel).filter(BorrowerModel.id == borrower_id).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    return borrower


class BorrowerCreateSchema(BaseModel):
    email: str
    first_name: str
    last_name: str


class BorrowerUpdateSchema(BaseModel):
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


@app.post("/borrowers", response_model=BorrowerSchema)
def create_borrower(data: BorrowerCreateSchema, db: Session = Depends(get_db)):
    new_borrower = BorrowerModel(**data.dict())
    db.add(new_borrower)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Borrower email already exists")
    db.refresh(new_borrower)
    return new_borrower


@app.put("/borrowers/{borrower_id}", response_model=BorrowerSchema)
def update_borrower(
    borrower_id: str, data: BorrowerUpdateSchema, db: Session = Depends(get_db)
):
    borrower = db.query(BorrowerModel).filter(BorrowerModel.id == borrower_id).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    
    # Allow updating to any email, including duplicates
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(borrower, key, value)
    
    db.commit()
    db.refresh(borrower)
    return borrower


@app.delete("/borrowers/{borrower_id}")
def delete_borrower(borrower_id: str, db: Session = Depends(get_db)):
    borrower = db.query(BorrowerModel).filter(BorrowerModel.id == borrower_id).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    
    # Delete associated loans
    db.query(LoanModel).filter(LoanModel.borrower_id == borrower_id).delete()
    
    # Delete the borrower
    db.delete(borrower)
    db.commit()
    return {"message": "Borrower deleted successfully"}


# Loan endpoints
@app.get("/loans", response_model=List[LoanWithRequestSchema])
def get_loans(borrower_id: str = None, db: Session = Depends(get_db)):
    query = db.query(LoanModel)
    if borrower_id:
        query = query.filter(LoanModel.borrower_id == borrower_id)
    
    loans = query.all()
    result = []
    for loan in loans:
        loan_dict = {
            "id": loan.id,
            "borrower_id": loan.borrower_id,
            "loan_amount": loan.loan_amount,
            "loan_date": loan.loan_date,
            "property_address": loan.property_address,
            "property_city": loan.property_city,
            "property_state": loan.property_state,
            "property_zip": loan.property_zip,
            "line_of_business": loan.line_of_business,
            "product_type": loan.product_type,
            "loan_purpose": loan.loan_purpose,
            "interest_rate": loan.interest_rate,
            "created_at": loan.created_at,
            "request": None,
            "submitted_data": None,
        }
        
        # Get latest request for this loan
        request = (
            db.query(Form1071RequestModel)
            .filter(Form1071RequestModel.loan_id == loan.id)
            .order_by(Form1071RequestModel.created_at.desc())
            .first()
        )
        
        if request:
            loan_dict["request"] = {
                "id": request.id,
                "guid": request.guid,
                "loan_id": request.loan_id,
                "borrower_id": request.borrower_id,
                "status": request.status,
                "request_sent_at": request.request_sent_at,
                "submitted_at": request.submitted_at,
                "created_at": request.created_at,
            }
            
            # Get submission data if exists
            submission = (
                db.query(Form1071SubmissionModel)
                .filter(Form1071SubmissionModel.request_id == request.id)
                .first()
            )
            if submission:
                loan_dict["submitted_data"] = {
                    "id": submission.id,
                    "request_id": submission.request_id,
                    "applicant_name": submission.applicant_name,
                    "applicant_email": submission.applicant_email,
                    "co_applicant_name": submission.co_applicant_name,
                    "co_applicant_email": submission.co_applicant_email,
                    "annual_income": submission.annual_income,
                    "liquid_assets": submission.liquid_assets,
                    "employment_status": submission.employment_status,
                    "credit_score_range": submission.credit_score_range,
                    "military_status": submission.military_status,
                    "veteran_status": submission.veteran_status,
                    "demographic_race": submission.demographic_race,
                    "demographic_ethnicity": submission.demographic_ethnicity,
                    "demographic_sex": submission.demographic_sex,
                    "demographic_age_range": submission.demographic_age_range,
                    "created_at": submission.created_at,
                    "updated_at": submission.updated_at,
                }
        
        result.append(loan_dict)
    
    return result


@app.get("/loans/{loan_id}", response_model=LoanWithRequestSchema)
def get_loan(loan_id: str, db: Session = Depends(get_db)):
    loan = db.query(LoanModel).filter(LoanModel.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    loan_dict = {
        "id": loan.id,
        "borrower_id": loan.borrower_id,
        "loan_amount": loan.loan_amount,
        "loan_date": loan.loan_date,
        "property_address": loan.property_address,
        "property_city": loan.property_city,
        "property_state": loan.property_state,
        "property_zip": loan.property_zip,
        "line_of_business": loan.line_of_business,
        "product_type": loan.product_type,
        "loan_purpose": loan.loan_purpose,
        "interest_rate": loan.interest_rate,
        "created_at": loan.created_at,
        "request": None,
        "submitted_data": None,
    }
    
    # Get latest request for this loan
    request = (
        db.query(Form1071RequestModel)
        .filter(Form1071RequestModel.loan_id == loan.id)
        .order_by(Form1071RequestModel.created_at.desc())
        .first()
    )
    
    if request:
        loan_dict["request"] = {
            "id": request.id,
            "guid": request.guid,
            "loan_id": request.loan_id,
            "borrower_id": request.borrower_id,
            "status": request.status,
            "request_sent_at": request.request_sent_at,
            "submitted_at": request.submitted_at,
            "created_at": request.created_at,
        }
        
        # Get submission data if exists
        submission = (
            db.query(Form1071SubmissionModel)
            .filter(Form1071SubmissionModel.request_id == request.id)
            .first()
        )
        if submission:
            loan_dict["submitted_data"] = {
                "id": submission.id,
                "request_id": submission.request_id,
                "applicant_name": submission.applicant_name,
                "applicant_email": submission.applicant_email,
                "co_applicant_name": submission.co_applicant_name,
                "co_applicant_email": submission.co_applicant_email,
                "annual_income": submission.annual_income,
                "liquid_assets": submission.liquid_assets,
                "employment_status": submission.employment_status,
                "credit_score_range": submission.credit_score_range,
                "military_status": submission.military_status,
                "veteran_status": submission.veteran_status,
                "demographic_race": submission.demographic_race,
                "demographic_ethnicity": submission.demographic_ethnicity,
                "demographic_sex": submission.demographic_sex,
                "demographic_age_range": submission.demographic_age_range,
                "created_at": submission.created_at,
                "updated_at": submission.updated_at,
            }
    
    return loan_dict


class LoanCreateSchema(BaseModel):
    borrower_id: str
    loan_amount: float
    loan_date: datetime
    property_address: str
    property_city: str
    property_state: str
    property_zip: str
    line_of_business: Optional[str] = None
    product_type: Optional[str] = None
    loan_purpose: str
    interest_rate: float


class LoanUpdateSchema(BaseModel):
    loan_amount: Optional[float] = None
    loan_date: Optional[datetime] = None
    property_address: Optional[str] = None
    property_city: Optional[str] = None
    property_state: Optional[str] = None
    property_zip: Optional[str] = None
    line_of_business: Optional[str] = None
    product_type: Optional[str] = None
    loan_purpose: Optional[str] = None
    interest_rate: Optional[float] = None


@app.post("/loans", response_model=LoanSchema)
def create_loan(data: LoanCreateSchema, db: Session = Depends(get_db)):
    # Verify borrower exists
    borrower = db.query(BorrowerModel).filter(BorrowerModel.id == data.borrower_id).first()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    
    payload = data.dict()
    payload["line_of_business"] = payload.get("line_of_business") or "Commercial Banking"
    payload["product_type"] = payload.get("product_type") or "Term Loan"

    new_loan = LoanModel(**payload)
    db.add(new_loan)
    db.commit()
    db.refresh(new_loan)
    return new_loan


@app.put("/loans/{loan_id}", response_model=LoanSchema)
def update_loan(loan_id: str, data: LoanUpdateSchema, db: Session = Depends(get_db)):
    loan = db.query(LoanModel).filter(LoanModel.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(loan, key, value)
    
    db.commit()
    db.refresh(loan)
    return loan


@app.delete("/loans/{loan_id}")
def delete_loan(loan_id: str, db: Session = Depends(get_db)):
    loan = db.query(LoanModel).filter(LoanModel.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Also delete associated requests and submissions
    requests = db.query(Form1071RequestModel).filter(Form1071RequestModel.loan_id == loan_id).all()
    for req in requests:
        db.query(Form1071SubmissionModel).filter(Form1071SubmissionModel.request_id == req.id).delete()
        db.delete(req)
    
    db.delete(loan)
    db.commit()
    return {"message": "Loan deleted successfully"}
@app.post("/1071-requests", response_model=Form1071RequestSchema)
def create_1071_request(
    request_data: Form1071RequestCreateSchema,
    db: Session = Depends(get_db),
):
    # Get loan to find borrower
    loan = db.query(LoanModel).filter(LoanModel.id == request_data.loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Look up borrower to get their name
    borrower = db.query(BorrowerModel).filter(BorrowerModel.id == loan.borrower_id).first()
    borrower_name = borrower_display_name(borrower)

    # Deactivate any prior active request rows for this loan.
    # Keep historical rows in DB so old links can be identified as inactive.
    deactivate_requests_for_loan(db, request_data.loan_id)

    # Create a new active request row with a fresh unique GUID
    unique_guid = generate_unique_guid(db)
    new_request = Form1071RequestModel(
        loan_id=request_data.loan_id,
        borrower_id=loan.borrower_id,
        guid=unique_guid,
        status="pending",
        request_sent_at=datetime.utcnow(),
        submitted_at=None,
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    # Build the form URL using the configured public frontend base URL
    form_url = f"{FRONTEND_URL}/form1071/{new_request.guid}"
    try:
        recipient_email = borrower.email if borrower and borrower.email else request_data.borrower_email
        send_collection_email(recipient_email, form_url, borrower_name)
    except Exception as e:
        print(f"Error sending email: {e}")

    return new_request


@app.get("/1071-requests/{guid}", response_model=Form1071RequestSchema)
def get_1071_request(guid: str, db: Session = Depends(get_db)):
    request = (
        db.query(Form1071RequestModel)
        .filter(Form1071RequestModel.guid == guid)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request


@app.put("/1071-requests/{request_id}", response_model=Form1071RequestSchema)
def resend_1071_request(request_id: str, db: Session = Depends(get_db)):
    """Resend by creating a new active request row and inactivating old rows."""
    request = (
        db.query(Form1071RequestModel)
        .filter(Form1071RequestModel.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Mark all prior request rows for this loan as inactive.
    deactivate_requests_for_loan(db, request.loan_id)

    # Create a brand new active request row with a fresh GUID.
    unique_guid = generate_unique_guid(db)
    new_request = Form1071RequestModel(
        loan_id=request.loan_id,
        borrower_id=request.borrower_id,
        guid=unique_guid,
        status="pending",
        request_sent_at=datetime.utcnow(),
        submitted_at=None,
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    # Send email with the new GUID
    form_url = f"{FRONTEND_URL}/form1071/{unique_guid}"
    try:
        borrower = db.query(BorrowerModel).filter(BorrowerModel.id == new_request.borrower_id).first()
        borrower_email = borrower.email if borrower else ""
        borrower_name = borrower_display_name(borrower)
        send_collection_email(borrower_email, form_url, borrower_name)
    except Exception as e:
        print(f"Error sending email: {e}")

    return new_request


# Form 1071 Submission endpoints
@app.post("/1071-submissions", response_model=Form1071SubmissionSchema)
def create_1071_submission(
    submission_data: Form1071SubmissionCreateSchema,
    db: Session = Depends(get_db),
):
    # Check if request exists
    request = (
        db.query(Form1071RequestModel)
        .filter(Form1071RequestModel.id == submission_data.request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.status == "inactive":
        raise HTTPException(
            status_code=400,
            detail="This form link is inactive. Please use the latest link from your email or contact your administrator.",
        )

    # Check if already submitted
    existing = (
        db.query(Form1071SubmissionModel)
        .filter(Form1071SubmissionModel.request_id == submission_data.request_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Form already submitted for this request"
        )

    # Create new submission
    new_submission = Form1071SubmissionModel(**submission_data.dict())
    db.add(new_submission)

    # Update request status to submitted
    request.status = "submitted"
    request.submitted_at = datetime.utcnow()

    db.commit()
    db.refresh(new_submission)

    return new_submission


@app.get("/1071-submissions/{request_id}", response_model=Form1071SubmissionSchema)
def get_1071_submission(request_id: str, db: Session = Depends(get_db)):
    submission = (
        db.query(Form1071SubmissionModel)
        .filter(Form1071SubmissionModel.request_id == request_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@app.get("/loans/{loan_id}/1071-submissions-history", response_model=List[Form1071SubmissionHistoryItemSchema])
def get_loan_1071_submissions_history(loan_id: str, db: Session = Depends(get_db)):
    loan = db.query(LoanModel).filter(LoanModel.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    rows = (
        db.query(Form1071SubmissionModel, Form1071RequestModel)
        .join(
            Form1071RequestModel,
            Form1071SubmissionModel.request_id == Form1071RequestModel.id,
        )
        .filter(Form1071RequestModel.loan_id == loan_id)
        .order_by(
            Form1071RequestModel.submitted_at.desc(),
            Form1071SubmissionModel.created_at.desc(),
        )
        .all()
    )

    history = []
    for submission, request in rows:
        history.append(
            {
                "id": submission.id,
                "request_id": submission.request_id,
                "request_guid": request.guid,
                "request_status": request.status,
                "request_sent_at": request.request_sent_at,
                "submitted_at": request.submitted_at,
                "applicant_name": submission.applicant_name,
                "applicant_email": submission.applicant_email,
                "co_applicant_name": submission.co_applicant_name,
                "co_applicant_email": submission.co_applicant_email,
                "annual_income": submission.annual_income,
                "liquid_assets": submission.liquid_assets,
                "employment_status": submission.employment_status,
                "credit_score_range": submission.credit_score_range,
                "military_status": submission.military_status,
                "veteran_status": submission.veteran_status,
                "demographic_race": submission.demographic_race,
                "demographic_ethnicity": submission.demographic_ethnicity,
                "demographic_sex": submission.demographic_sex,
                "demographic_age_range": submission.demographic_age_range,
                "created_at": submission.created_at,
                "updated_at": submission.updated_at,
            }
        )

    return history


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
