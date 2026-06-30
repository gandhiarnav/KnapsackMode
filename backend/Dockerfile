# Use official lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source
COPY . .

# Cloud Run always uses port 8080
EXPOSE 8080

# Use exec form (no shell) — avoids $PORT expansion issues
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
