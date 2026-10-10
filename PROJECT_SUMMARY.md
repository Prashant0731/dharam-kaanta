# Dharam Kaanta - Weighbridge Management System

## Project Structure
```
C:\Users\prash\Desktop\NITIN\TL\
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── PhotoCapture.tsx  # Camera/Gallery upload with compression
│   │   │   └── Toast.tsx
│   │   ├── pages/
│   │   │   ├── EntryPage.tsx     # Main entry form with table
│   │   │   └── DashboardPage.tsx # Stats, filters, exports
│   │   ├── services/
│   │   │   ├── api.ts            # API client + localStorage fallback
│   │   │   ├── export.ts         # Excel/PDF/Word export
│   │   │   └── image.ts          # Image compression
│   │   ├── types/index.ts        # TypeScript interfaces
│   │   ├── App.tsx               # Main app with routing
│   │   └── main.tsx              # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── backend/                      # Flask API
│   ├── flask_app.py              # Main Flask app with all endpoints
│   ├── requirements.txt
│   └── dharam_kaanta.db          # SQLite database (auto-created)
│
├── .github/workflows/            # CI/CD for GitHub Pages + Render
└── PROJECT_SUMMARY.md
```

## Features Implemented

### Frontend (React + TypeScript)
- **Entry Page**: 7-column table (Vehicle No., Tare, Gross, Net, Rupees, Vehicle Photo, Gross Photo, Action)
- **Camera/Gallery Upload**: PhotoCapture component with image compression (800px, 60% quality)
- **Auto-calculation**: Net = Gross - Tare, Rupees = Net / 5
- **Save/Clear**: Per-row operations, vehicle number persists after save
- **Dashboard**: Stats cards, search/filter, pagination
- **Export**: Excel (.xlsx), PDF, Word (.docx)
- **Offline Support**: localStorage fallback when API unavailable
- **Responsive**: Tailwind CSS, works on mobile/desktop

### Backend (Flask + SQLite)
- **REST API**: CRUD for entries, stats, bulk operations
- **Export Endpoints**: `/api/v1/export?format=excel|pdf|word`
- **CORS Enabled**: Works with Vite dev server proxy
- **SQLite**: Auto-creates `dharam_kaanta.db` on first run

### Deployment Ready
- **Frontend**: GitHub Pages (vite build → dist/)
- **Backend**: Render/Railway compatible
- **GitHub Actions**: Auto-deploy on push to main

## Running Locally

### Terminal 1 - Frontend
```cmd
cd C:\Users\prash\Desktop\NITIN\TL\frontend
npm run dev
# Opens at http://localhost:5173/TL/
```

### Terminal 2 - Backend
```cmd
cd C:\Users\prash\Desktop\NITIN\TL\backend
C:\Users\prash\AppData\Local\Programs\Python\Python312\python.exe flask_app.py
# Runs at http://localhost:8000
```

### Test API
```cmd
# Entries
GET  http://localhost:8000/api/v1/entries
POST http://localhost:8000/api/v1/entries
PUT  http://localhost:8000/api/v1/entries/<id>
DELETE http://localhost:8000/api/v1/entries/<id>

# Stats
GET http://localhost:8000/api/v1/stats

# Export
GET http://localhost:8000/api/v1/export?format=excel|pdf|word
```

## Key Files to Remember
- `frontend/src/pages/EntryPage.tsx` - Main weighbridge entry form
- `frontend/src/components/PhotoCapture.tsx` - Camera/Gallery with compression
- `backend/flask_app.py` - Complete Flask API
- `frontend/vite.config.ts` - Proxy config for `/TL/api` → localhost:8000

## GitHub Deployment
1. Push to GitHub repo
2. Enable GitHub Pages → GitHub Actions
3. Backend: Deploy `backend/` folder to Render/Railway
4. Update `VITE_API_URL` in frontend to production API URL