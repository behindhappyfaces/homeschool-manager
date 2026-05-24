# Homeschool Manager

A web-based homeschool management system for tracking assignments and student mastery, with Obsidian vault sync and Claude AI integration.

## Project Structure

```
homeschool-app/
├── server.js              # Express server, entry point
├── src/
│   ├── routes/
│   │   ├── students.js    # GET/PUT student profiles and mastery
│   │   ├── assignments.js # CRUD assignments
│   │   ├── assessments.js # Assessment questions and scoring
│   │   └── ai.js          # Claude AI endpoints
│   └── utils/
│       ├── dataStore.js   # JSON file read/write helpers
│       ├── obsidian.js    # Obsidian vault sync (writes markdown notes)
│       └── claude.js      # Anthropic SDK integration
├── data/
│   ├── students.json      # Student profiles and mastery scores
│   ├── subjects.json      # Subject definitions and mastery levels
│   ├── assignments.json   # All assignments
│   ├── assessment-results.json  # Completed assessment results
│   └── assessments/       # Assessment question banks by grade
│       ├── grade-k/
│       ├── grade-1/
│       ├── grade-3/
│       └── grade-4/
└── public/
    ├── index.html         # Single-page app shell
    ├── css/styles.css     # Dark theme UI styles
    └── js/app.js          # Frontend logic (vanilla JS)
```

## Students

- **Student 1**: 1st grade (2025-2026), reviewing Kindergarten, entering 2nd grade Fall 2026
- **Student 2**: 4th grade (2025-2026), reviewing 3rd grade, entering 5th grade Fall 2026

## Running the App

```bash
npm install
npm start        # production
npm run dev      # development with nodemon
```

App runs at http://localhost:3000

## AI Features

AI features require `ANTHROPIC_API_KEY` in `.env`. Without it, the app runs fully but AI panels show a "not enabled" message. Features:
- Daily plan generation
- Per-subject lesson suggestions
- Assessment feedback

Model: `claude-sonnet-4-6`

## Obsidian Sync

Notes are auto-written to `/Users/deborahsmith/Documents/collab/Homeschool/`:
- `Students/` — updated when student mastery changes
- `Assignments/YEAR/` — created when assignments are added/completed
- `Progress/YEAR/` — generated progress reports

## Data Storage

All data is stored in JSON files under `data/`. No database required.

## Expanding

- Add new assessment grades: create `data/assessments/grade-N/questions.json`
- Add farm-integrated subjects: add to `data/subjects.json` and student subjects
- Add new students: POST to `/api/students` or edit `data/students.json` directly
- Grades K–12 supported by design

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| ANTHROPIC_API_KEY | No | Enables AI features |
| PORT | No | Server port (default 3000) |
