# Use official lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy and install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source
COPY . .

# Cloud Run injects PORT env var; default to 8080
ENV PORT=8080

# Start with uvicorn (gunicorn as process manager in production)
CMD exec uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
