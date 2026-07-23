# KnapsackMode 🎒

> **Last-minute exam & interview prep — optimized, not just summarized.**

KnapsackMode takes your raw study material and a time budget, then uses a **knapsack-style dynamic programming algorithm** to tell you exactly what to study, in what order, and for how long. It's not a summarizer — it's a time optimizer.

---

## Features

- **Topic Extraction & Scoring** — Paste any notes, syllabus, or job description; Gemini AI extracts topics and scores each by importance, difficulty, and estimated study time.
- **Knapsack Optimization** — A custom DP algorithm allocates your time budget across topics at varying depths (skim / review / deep), maximizing total value covered within your constraint.
- **Sprint Mode** — A countdown-driven study interface that walks you through each topic with AI-generated study cards tailored to the allocated depth level.
- **Dynamic Re-allocation** — Hit "Need More Time" or "Got It" early, and the algorithm instantly re-optimizes the remaining plan with the updated time budget.
- **Quick-Fire Quiz** — End-of-sprint quiz generated from your studied topics to test retention.
- **Session Persistence** — Study sessions are saved locally so you can resume where you left off.
- **Exam & Interview Modes** — Context-aware prompts tune topic scoring and study cards for either mode.

---

## 🏗️ Architecture

```
KnapsackMode/
├── backend/          # FastAPI + Python — AI calls & allocation logic
│   ├── main.py           # App entry point, CORS, router registration
│   ├── routers/
│   │   ├── extract.py    # POST /api/extract-topics
│   │   ├── allocate.py   # POST /api/allocate
│   │   ├── studycard.py  # POST /api/study-card
│   │   └── quiz.py       # POST /api/quiz
│   ├── services/
│   │   └── gemini.py     # All Gemini AI calls (extraction, study cards, quiz)
│   ├── Dockerfile
│   └── requirements.txt
│
└── frontend/         # React + Vite — UI
    └── src/
        ├── App.jsx           # State machine: input → plan → sprint
        ├── screens/
        │   ├── InputScreen.jsx   # Paste material + set time budget
        │   ├── PlanScreen.jsx    # Review & edit the generated plan
        │   └── SprintScreen.jsx  # Countdown timer + study cards + re-allocation
        ├── hooks/
        │   └── useSession.js     # LocalStorage session persistence
        └── services/             # API client
```

### How the Algorithm Works

The core time-allocation engine is a **bounded knapsack with partial coverage**:

1. Each topic is expanded into 2–3 discrete depth levels — e.g. *skim* (40% value, 25% time) and *deep* (100% value, 100% time).
2. A DP knapsack runs over all `(topic, depth)` pairs to find the combination that **maximizes total importance covered** within the time budget.
3. The resulting plan is sorted by importance-per-minute (most efficient first).
4. When the user skips ahead or asks for more time, **Step 2 re-runs live** on remaining topics with the updated remaining time.

---

## 🚀 Live Deployment

| Service | URL |
|---------|-----|
| **Backend API** | `https://knapsackmode-backend-967643216830.us-central1.run.app` |
| **API Docs (Swagger)** | `https://knapsackmode-backend-967643216830.us-central1.run.app/docs` |
| **Frontend** | https://knapsackmode-501016.web.app |

---

## 🛠️ Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com)

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start the dev server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

> By default the frontend calls the **deployed backend**. To point it at your local backend instead, set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local`.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Your Gemini API key from [aistudio.google.com](https://aistudio.google.com) |
| `GEMINI_MODEL` | No | Model override. Default: `gemini-1.5-flash`. Options: `gemini-1.5-flash`, `gemini-1.5-flash-8b`, `gemini-2.0-flash`, `gemini-2.5-flash` |
| `FRONTEND_URL` | No | Deployed frontend URL — added to CORS allowed origins |

---

## 📡 API Reference

All endpoints are prefixed with `/api`. A full interactive reference is available at `/docs`.

### `POST /api/extract-topics`
Extracts topics from raw study material and scores each one.

**Request body:**
```json
{
  "raw_text": "Your notes, syllabus, or job description...",
  "time_budget": 45,
  "context_type": "exam"
}
```
- `context_type`: `"exam"` | `"interview"`

**Response:**
```json
{
  "topics": [
    {
      "topic": "Binary Search Trees",
      "importance": 9,
      "difficulty": 7,
      "time_needed_minutes": 20
    }
  ]
}
```

---

### `POST /api/allocate`
Runs the knapsack optimization algorithm on a list of topics.

**Request body:**
```json
{
  "topics": [...],
  "time_budget": 45
}
```

**Response:** An ordered list of `{ topic, allocated_minutes, depth_level }`.

---

### `POST /api/study-card`
Generates a condensed study card for a topic at a given depth level.

**Request body:**
```json
{
  "topic": "Binary Search Trees",
  "depth_level": "skim",
  "context_type": "exam",
  "allocated_minutes": 8
}
```

---

### `POST /api/quiz`
Generates a quick quiz based on the topics covered in the sprint.

---

### `GET /api/health`
Health check. Returns `{ "status": "ok", "service": "KnapsackMode API" }`.

---

## ☁️ Deployment

### Backend — Google Cloud Run

The backend is containerized and deployed to Cloud Run.

```bash
cd backend

# Build and push the Docker image
gcloud builds submit --tag gcr.io/<PROJECT_ID>/knapsackmode-backend

# Deploy to Cloud Run
gcloud run deploy knapsackmode-backend \
  --image gcr.io/<PROJECT_ID>/knapsackmode-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=<your_key>,FRONTEND_URL=<your_frontend_url>
```

### Frontend — Firebase Hosting

```bash
cd frontend

# Build production bundle
npm run build

# Deploy to Firebase (no global install required)
npx firebase-tools deploy --only hosting
```

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6 |
| Styling | Vanilla CSS |
| Backend | FastAPI, Python 3.10 |
| AI | Google Gemini (`google-genai >= 2.0.0`) |
| Containerization | Docker |
| Backend Hosting | Google Cloud Run |
| Frontend Hosting | Firebase Hosting |

---

## 📄 License

MIT
