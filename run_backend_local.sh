#!/bin/zsh
set -e

PROJECT_ROOT="/Users/sunny/Documents/Sunny/巨大/Vide Coding/Ozon自动调价"
BACKEND_DIR="$PROJECT_ROOT/backend"

cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install -r requirements.txt

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

PORT=8001
while lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "Starting backend at http://localhost:${PORT} ..."
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --reload
