#!/bin/bash
# Clear port 5001 - Useful when port is stuck

PORT=5002

echo "🔍 Checking for processes using port $PORT..."

# macOS/Linux
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PIDS=$(lsof -ti:$PORT 2>/dev/null)
    if [ -z "$PIDS" ]; then
        echo "✅ Port $PORT is free"
    else
        echo "🔪 Killing processes using port $PORT: $PIDS"
        echo $PIDS | xargs kill -9 2>/dev/null
        sleep 1
        if lsof -i:$PORT >/dev/null 2>&1; then
            echo "⚠️  Port $PORT still in use"
        else
            echo "✅ Port $PORT is now free"
        fi
    fi
# Windows
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "Windows detected - use: netstat -ano | findstr :$PORT"
    echo "Then: taskkill /F /PID [PID]"
fi
