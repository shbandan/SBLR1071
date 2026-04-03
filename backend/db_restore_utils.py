import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

try:
    import pyodbc as _odbc_module
except ModuleNotFoundError:
    import pypyodbc as _odbc_module


DEFAULT_DATABASE_URL = (
    "mssql+pyodbc://@localhost:1433/sblr1071_v2"
    "?driver=ODBC+Driver+18+for+SQL+Server&trusted_connection=yes&TrustServerCertificate=yes"
)


def get_database_url() -> str:
    return os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def create_sqlalchemy_engine(url: str):
    if url.startswith("mssql+pyodbc"):
        return create_engine(url, future=True, pool_pre_ping=True, module=_odbc_module)
    return create_engine(url, future=True, pool_pre_ping=True)


def ensure_database_exists(database_url: str) -> str:
    url = make_url(database_url)

    if not url.drivername.startswith("mssql"):
        raise ValueError(f"Unsupported DATABASE_URL for restore flow: {url.drivername}")

    db_name = url.database
    if not db_name:
        raise ValueError("DATABASE_URL must include a target database name")

    admin_url = url.set(database="master")
    admin_engine = create_sqlalchemy_engine(str(admin_url))

    try:
        with admin_engine.begin() as conn:
            escaped_name = db_name.replace("]", "]]")
            conn.execute(text(f"IF DB_ID('{db_name}') IS NULL CREATE DATABASE [{escaped_name}];"))
    finally:
        admin_engine.dispose()

    return db_name