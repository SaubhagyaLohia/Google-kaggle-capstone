# AI Career Copilot

AI Career Copilot is a production-quality multi-agent web application built using **Google ADK 2.0**, **FastAPI**, **SQLite**, and **Next.js**. It helps users optimize their job applications by analyzing resumes, identifying skill gaps, conducting grammar reviews, generating interview preparation questions, and creating personalized cover letters.

## Features

- **Upload Resume**: Supports drag-and-drop file uploading for PDF and DOCX formats.
- **Job Description matching (Optional)**: Automatically compares resume skills against a job description.
- **Multi-Agent Orchestration**: Planner/Orchestrator manages specialist agents sequentially and dynamically via a graph workflow.
- **Custom MCP Integration**: Filesystem, SQLite, and Browser MCP servers are integrated via Stdio.
- **Analysis History**: Stores previously generated reports, ATS scores, and target roles in SQLite for reopening or deleting.
- **Live Status Updates**: streams real-time status of each agent execution to the UI via Server-Sent Events (SSE).

---

## Folder Structure

```
├── backend/
│   ├── agents/          # ADK workflow and agent definitions
│   ├── app/             # FastAPI app and config setup
│   ├── database/        # SQLite DB initialization & CRUD operations
│   ├── mcp/             # Filesystem, SQLite, and Browser MCP servers
│   ├── pyproject.toml   # Python project dependencies
│   ├── uploads/         # Uploaded resumes folder (safe filenames)
│   └── reports/         # Exported markdown reports
├── database/            # SQLite copilot.db destination
├── frontend/            # Next.js 16 App Router SPA with TailwindCSS
└── README.md            # Workspace instruction file
```

---

## Setup & Running

### Prerequisites
- Node.js (v18+)
- Python (v3.11+)
- `uv` (Fast Python package manager)

### 1. Setup Environment
Ensure your Gemini API Key is configured in your terminal environment:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

### 2. Start the Backend Server
```bash
cd backend
# Install dependencies and sync virtual env
uv sync
# Start backend API (runs on port 8000)
uv run uvicorn app.fast_api_app:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the Frontend Server
```bash
cd frontend
# Install node packages
npm install
# Start Next.js (runs on port 3000 or 3001)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) (or port 3000) in your browser to start using the Career Copilot!
