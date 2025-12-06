#!/bin/bash
# Restart all Superset services for testing

set -e

echo "🛑 Stopping all services..."
pkill -f "superset run" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "webpack" 2>/dev/null || true
sleep 3

echo "✅ All services stopped"
echo ""

echo "🚀 Starting Superset Backend..."
cd /Users/stephocay/projects/hispuganda/superset

# Activate virtual environment
source venv/bin/activate

# Set configuration
export SUPERSET_CONFIG_PATH=/Users/stephocay/projects/hispuganda/superset/superset_config.py
export FLASK_APP=superset

# Start backend
nohup superset run -p 8088 --with-threads --reload --debugger > superset_backend.log 2>&1 &
BACKEND_PID=$!

echo "✅ Backend started (PID: $BACKEND_PID)"
echo "   Logs: tail -f superset_backend.log"
echo ""

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:8088/health > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Check if backend is actually running
if lsof -ti:8088 > /dev/null 2>&1; then
    echo "✅ Backend confirmed running on port 8088"
else
    echo "❌ Backend failed to start. Check logs:"
    echo "   tail -50 superset_backend.log"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Backend is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Access Superset at: http://localhost:8088"
echo ""
echo "📋 Next steps:"
echo "   1. Open http://localhost:8088 in your browser"
echo "   2. Login with your credentials"
echo "   3. Navigate to your DHIS2 dataset"
echo "   4. Create a chart:"
echo "      - Chart Type: Bar Chart"
echo "      - X-Axis: Select 'OrgUnit' (should work now!)"
echo "      - Metrics: Select your data elements"
echo "      - Filter: Add 'Period' filter if needed"
echo ""
echo "✨ The DHIS2 charting fix is active!"
echo "   - No forced Period as X-axis"
echo "   - Select any column as X-axis"
echo "   - No datetime column errors"
echo ""
echo "📊 To start frontend (optional):"
echo "   ./fix-frontend.sh"
echo ""

