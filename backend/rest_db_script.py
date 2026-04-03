from db_restore_utils import ensure_database_exists, get_database_url


if __name__ == "__main__":
    database_url = get_database_url()
    db_name = ensure_database_exists(database_url)
    print(f"Database ready: {db_name}")

    # Import after DB existence is guaranteed so metadata operations can connect cleanly.
    from reset_fresh_data import reset_and_seed

    reset_and_seed()
