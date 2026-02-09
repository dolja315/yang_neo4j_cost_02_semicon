#!/bin/bash
set -e

# PostgreSQL setup
PG_VERSION=15
PG_DATA="/var/lib/postgresql/$PG_VERSION/main"
PG_BIN="/usr/lib/postgresql/$PG_VERSION/bin"
PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"

echo "Checking PostgreSQL Data Directory..."

# Ensure directories exist and permissions are correct
# /var/lib/postgresql is usually created by apt install, but we ensure ownership
mkdir -p "$PG_DATA"
chown -R postgres:postgres /var/lib/postgresql

# Initialize database cluster if not exists
if [ ! -s "$PG_DATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL Database Cluster..."
    # Initialize with trust for local connections (simplified for container internal use)
    su - postgres -c "$PG_BIN/initdb -D $PG_DATA --auth-local=trust --auth-host=trust"

    # Start temporary server to create user/db
    # We point to the default config file location, assuming apt installed it there.
    # If not, initdb created a postgresql.conf in PG_DATA, we can use that.
    # Let's use the one in PG_DATA to be safe and self-contained.

    echo "Starting temporary PostgreSQL for setup..."
    su - postgres -c "$PG_BIN/pg_ctl -D $PG_DATA -w start"

    echo "Creating Database and User..."

    # Environment variables
    DB_USER=${POSTGRES_USER:-postgres}
    DB_PASS=${POSTGRES_PASSWORD:-postgres}
    DB_NAME=${POSTGRES_DB:-semicon_cost}

    # Create user if not postgres (postgres already exists)
    if [ "$DB_USER" != "postgres" ]; then
        echo "Creating user $DB_USER..."
        su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\""
        su - postgres -c "psql -c \"ALTER USER $DB_USER WITH SUPERUSER;\""
    else
        echo "Updating postgres user password..."
        su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '$DB_PASS';\""
    fi

    # Create DB
    echo "Creating database $DB_NAME..."
    su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\"" || echo "Database $DB_NAME might already exist."

    echo "Stopping temporary PostgreSQL..."
    su - postgres -c "$PG_BIN/pg_ctl -D $PG_DATA -m fast -w stop"
else
    echo "PostgreSQL Data Directory already initialized."
fi

# Start Supervisor
echo "Starting Supervisor..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
