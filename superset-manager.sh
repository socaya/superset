#!/bin/bash
# Superset Management Script
# Provides commands to start, stop, restart, and manage Superset

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/Users/stephocay/projects/hispuganda/superset"
VENV_DIR="$PROJECT_DIR/.venv"
CONFIG_PATH="$PROJECT_DIR/superset_config.py"
LOG_FILE="$PROJECT_DIR/superset_backend.log"
PID_FILE="$PROJECT_DIR/superset.pid"
CACHE_DIR="$PROJECT_DIR/superset_home/cache"

# Print colored message
print_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC}  $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Check if Superset is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi

    # Fallback: check by port
    if lsof -ti:8088 > /dev/null 2>&1; then
        return 0
    fi

    return 1
}

# Start Superset
start_superset() {
    print_header "🚀 Starting Superset"

    if is_running; then
        print_warning "Superset is already running"
        print_info "Use './superset-manager.sh stop' to stop it first"
        print_info "Or use './superset-manager.sh restart' to restart"
        exit 0
    fi

    cd "$PROJECT_DIR"

    # Activate virtual environment
    print_info "Activating virtual environment..."
    source "$VENV_DIR/bin/activate"

    # Set configuration
    export SUPERSET_CONFIG_PATH="$CONFIG_PATH"
    export FLASK_APP=superset

    print_info "Configuration: $SUPERSET_CONFIG_PATH"
    print_info "Starting server on http://localhost:8088"
    echo ""

    # Start Superset in background
    nohup superset run -p 8088 --with-threads --reload --debugger > "$LOG_FILE" 2>&1 &
    SUPERSET_PID=$!

    # Save PID
    echo "$SUPERSET_PID" > "$PID_FILE"

    # Wait for startup
    print_info "Waiting for Superset to start..."
    for i in {1..30}; do
        sleep 1
        if curl -s http://localhost:8088/health > /dev/null 2>&1; then
            print_success "Superset started successfully - PID: $SUPERSET_PID"
            echo ""
            print_info "Access Superset at: http://localhost:8088"
            print_info "View logs: tail -f $LOG_FILE"
            print_info "Stop server: ./superset-manager.sh stop"
            echo ""
            return 0
        fi
        echo -n "."
    done

    echo ""
    print_error "Superset failed to start"
    print_info "Check logs: tail -50 $LOG_FILE"
    exit 1
}

# Stop Superset
stop_superset() {
    print_header "🛑 Stopping Superset"

    if ! is_running; then
        print_warning "Superset is not running"
        return 0
    fi

    # Kill by PID file
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        print_info "Stopping Superset - PID: $PID..."
        kill -TERM "$PID" 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if ps -p "$PID" > /dev/null 2>&1; then
            print_warning "Process still running, forcing shutdown..."
            kill -9 "$PID" 2>/dev/null || true
        fi

        rm -f "$PID_FILE"
    fi

    # Fallback: kill by port
    if lsof -ti:8088 > /dev/null 2>&1; then
        print_info "Killing processes on port 8088..."
        lsof -ti:8088 | xargs kill -9 2>/dev/null || true
    fi

    # Also kill by process name
    pkill -f "superset run" 2>/dev/null || true

    sleep 1

    if ! is_running; then
        print_success "Superset stopped successfully"
    else
        print_error "Failed to stop Superset"
        exit 1
    fi
}

# Restart Superset
restart_superset() {
    print_header "🔄 Restarting Superset"
    stop_superset
    sleep 2
    start_superset
}

# Show Superset status
status_superset() {
    print_header "📊 Superset Status"

    if is_running; then
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            print_success "Superset is running - PID: $PID"
        else
            print_success "Superset is running"
        fi

        # Show port info
        print_info "Port 8088: In use"

        # Show process info
        ps aux | grep "[s]uperset run" | head -1 || true

        # Test health endpoint
        if curl -s http://localhost:8088/health > /dev/null 2>&1; then
            print_success "Health check: OK"
        else
            print_warning "Health check: Failed"
        fi

        echo ""
        print_info "Access: http://localhost:8088"

    else
        print_warning "Superset is not running"
        echo ""
        print_info "Start with: ./superset-manager.sh start"
    fi
}

# View logs
view_logs() {
    print_header "📋 Superset Logs"

    if [ ! -f "$LOG_FILE" ]; then
        print_warning "Log file not found: $LOG_FILE"
        return 1
    fi

    print_info "Showing last 50 lines (press Ctrl+C to exit, or use 'follow' to tail)"
    echo ""

    if [ "$1" == "follow" ]; then
        tail -f "$LOG_FILE"
    else
        tail -50 "$LOG_FILE"
    fi
}

# Clear cache
clear_cache() {
    print_header "🧹 Clearing Cache"

    if is_running; then
        print_error "Please stop Superset before clearing cache"
        print_info "Run: ./superset-manager.sh stop"
        exit 1
    fi

    if [ -d "$CACHE_DIR" ]; then
        print_info "Clearing cache directory: $CACHE_DIR"
        rm -rf "$CACHE_DIR"/*
        print_success "Cache cleared"
    else
        print_warning "Cache directory not found: $CACHE_DIR"
    fi

    # Clear Python cache
    print_info "Clearing Python cache..."
    find "$PROJECT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$PROJECT_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    print_success "Python cache cleared"
}

# Database upgrade
db_upgrade() {
    print_header "🔧 Database Upgrade"

    cd "$PROJECT_DIR"
    source "$VENV_DIR/bin/activate"
    export SUPERSET_CONFIG_PATH="$CONFIG_PATH"

    print_info "Running database migrations..."
    superset db upgrade

    print_success "Database upgraded"
}

# Health check
health_check() {
    print_header "🏥 Health Check"

    # Check virtual environment
    if [ -d "$VENV_DIR" ]; then
        print_success "Virtual environment: OK"
    else
        print_error "Virtual environment: Missing"
    fi

    # Check config file
    if [ -f "$CONFIG_PATH" ]; then
        print_success "Configuration file: OK"
    else
        print_error "Configuration file: Missing"
    fi

    # Check if running
    if is_running; then
        print_success "Process: Running"

        # Check HTTP endpoint
        if curl -s http://localhost:8088/health > /dev/null 2>&1; then
            print_success "HTTP endpoint: Responding"
        else
            print_error "HTTP endpoint: Not responding"
        fi
    else
        print_warning "Process: Not running"
    fi

    # Check port
    if lsof -ti:8088 > /dev/null 2>&1; then
        print_info "Port 8088: In use"
    else
        print_info "Port 8088: Available"
    fi
}

# Show usage
show_usage() {
    cat << EOF
Superset Management Script

Usage: ./superset-manager.sh [command]

Commands:
    start       Start Superset backend
    stop        Stop Superset backend
    restart     Restart Superset backend
    status      Show Superset status
    logs        View last 50 lines of logs
    logs follow Follow logs in real-time
    cache       Clear cache and Python bytecode
    db-upgrade  Run database migrations
    health      Run health check
    help        Show this help message

Examples:
    ./superset-manager.sh start
    ./superset-manager.sh restart
    ./superset-manager.sh logs follow
    ./superset-manager.sh status

Access Superset at: http://localhost:8088

EOF
}

# Main script logic
main() {
    case "${1:-start}" in
        start)
            start_superset
            ;;
        stop)
            stop_superset
            ;;
        restart)
            restart_superset
            ;;
        status)
            status_superset
            ;;
        logs)
            view_logs "$2"
            ;;
        cache|clear-cache)
            clear_cache
            ;;
        db-upgrade|migrate)
            db_upgrade
            ;;
        health|check)
            health_check
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"


