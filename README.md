# Dharam Kaanta - Weighbridge Management System

A full-stack weighbridge management system with entry panel, dashboard, photo capture, exports, and persistent database.

## 🌐 Live URLs

| Service | URL |
|---------|-----|
| **Frontend** | https://prashant0731.github.io/dharam-kaanta/ |
| **Backend API** | https://dharam-kaanta.onrender.com |
| **Health Check** | https://dharam-kaanta.onrender.com/health |
| **API Docs** | https://dharam-kaanta.onrender.com/api/v1/entries |
| **Database** | https://supabase.com/dashboard/project/hnaehpwgxiyhlarqlnnm/editor |

---

## ✨ Features

### Entry Panel (Operator Workstation)
- **Tyre Type** - Selectable (Radial, Bias, Tube, Tubeless, Other) - Admin editable only
- **Vehicle Number** - Editable, persists on Clear
- **Tare Weight** - Editable, persists on Clear
- **Gross Weight** - Editable, clears on Clear
- **Net Weight** - Auto: `Gross - Tare`
- **Amount** - Auto: `Net / 5`
- **Photos** - Vehicle & Gross (Camera/Gallery with compression)
- **Auto Timestamp** - On Save
- **Save/Clear** - Clear preserves Tyre Type, Vehicle, Tare

### Dashboard (Admin/Storage)
- **Saved Records** - All entries with Date, Time, Tyre Type, Vehicle, Weights, Amount
- **Search** - Fast vehicle number search
- **Filters** - Date range, vehicle filter
- **Edit** - Update records (Admin can edit Tyre Type)
- **Copy** - Single record (tab-separated for Excel) + Bulk copy all
- **Export** - Excel (.xlsx), PDF, Word (.docx) with **embedded images**
- **Grand Totals** - Tare, Gross, Net, Amount in exports
- **Photo Preview** - Click to zoom modal

### System Features
- **Theme** - Light / Dark / System (persists)
- **Roles** - Admin / Operator (Tyre Type editable only in Admin)
- **Offline Support** - localStorage fallback
- **Responsive** - Mobile & desktop

---

## 🏗 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Backend      │────▶│    Database     │
│  (GitHub Pages) │     │    (Render)     │     │   (Supabase)    │
│                 │     │                 │     │                 │
│ React + TS      │     │ Flask + PSQL    │     │ PostgreSQL      │
│ Vite + Tailwind │     │ REST API        │     │ 500MB Free      │
│ GitHub Actions  │     │ Auto-deploy     │     │ Persistent      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 🚀 Deployment

### Frontend → GitHub Pages
- Auto-deploys on push to `main` (via GitHub Actions)
- Base path: `/dharam-kaanta/`
- Build: `npm run build` → `dist/` → GitHub Pages

### Backend → Render
- Auto-deploys on push to `main` (Root: `backend/`)
- Build: `pip install -r requirements.txt`
- Start: `python flask_app.py`
- Database: Supabase PostgreSQL (via `DATABASE_URL` env var)

### Database → Supabase
- Free tier: 500MB PostgreSQL
- Connection pooling (Transaction Pooler, port 6543)
- Auto-migrations on startup

---

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- Python 3.12+
- PostgreSQL (or use SQLite fallback)

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173/dharam-kaanta/
```

### Backend
```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."  # or omit for SQLite
python flask_app.py  # http://localhost:8000
```

### Docker (Both)
```bash
docker-compose up -d
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
```

---

## 🔐 Environment Variables

### Frontend (`.env.production`)
```env
VITE_API_URL=https://dharam-kaanta.onrender.com/api/v1
```

### Backend (Render Environment)
```env
DATABASE_URL=postgresql://postgres.hnaehpwgxiyhlarqlnnm:KOL5cyHaPs7Mer56@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### GitHub Pages Secret
```
RENDER_BACKEND_URL=dharam-kaanta.onrender.com
```

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/entries` | List entries (with filters) |
| POST | `/api/v1/entries` | Create entry |
| GET | `/api/v1/entries/:id` | Get entry |
| PUT | `/api/v1/entries/:id` | Update entry |
| DELETE | `/api/v1/entries/:id` | Delete entry |
| POST | `/api/v1/entries/bulk` | Bulk create |
| GET | `/api/v1/stats` | Dashboard stats |
| GET | `/api/v1/export?format=excel\|pdf\|word` | Export data |
| GET | `/health` | Health check |

---

## 📁 Project Structure

```
TL/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # EntryPage, DashboardPage
│   │   ├── services/         # API, export, image utils
│   │   ├── types/            # TypeScript types
│   │   └── App.tsx           # Main app with routing
│   ├── vite.config.ts        # Base: /dharam-kaanta/
│   └── package.json
│
├── backend/                   # Flask + PostgreSQL
│   ├── flask_app.py          # Main application
│   ├── requirements.txt      # Flask, psycopg2, etc.
│   ├── Dockerfile            # Container config
│   └── render.yaml           # Render IaC
│
├── docker-compose.yml        # Local dev stack
├── DEPLOYMENT.md             # Detailed deployment guide
└── README.md                 # This file
```

---

---

## 🔧 Troubleshooting

### Frontend Issues

#### White Screen / Blank Page
| Symptom | Cause | Solution |
|---------|-------|----------|
| White screen, no errors | Router basename mismatch | Ensure `vite.config.ts` `base` matches `BrowserRouter basename` in `App.tsx` (both `/dharam-kaanta/`) |
| 404 on assets (JS/CSS) | Wrong base path | Check `vite.config.ts` `base: '/dharam-kaanta/'` matches GitHub Pages URL |
| 404 on favicon | Wrong favicon path | Update `index.html` favicon href to `/dharam-kaanta/favicon.svg` |
| "Failed to fetch" | CORS error | Ensure backend CORS allows `https://prashant0731.github.io` |
| React error in console | Component crash | Check browser console (F12) for red errors; usually null reference |

#### Build/Deploy Issues
| Error | Solution |
|-------|----------|
| `npm run build` fails | Check TypeScript errors: `npx tsc --noEmit` |
| GitHub Actions fails | Check Actions tab logs; ensure `RENDER_BACKEND_URL` secret is set |
| 404 on GitHub Pages | Enable GitHub Pages → Source: "GitHub Actions" in repo settings |

### Backend Issues

#### Database Connection
| Error | Solution |
|-------|----------|
| `psycopg2.OperationalError: Network is unreachable` | Use Transaction Pooler (port 6543) not Direct Connection |
| `FATAL: no tenant identifier provided` | Add `?sslmode=require` to `DATABASE_URL` |
| `FATAL: password authentication failed` | Check password in `DATABASE_URL`; reset in Supabase if needed |
| `ModuleNotFoundError: No module named 'flask'` | Ensure `requirements.txt` has `flask` and `flask-cors` |

#### Supabase Connection
| Issue | Solution |
|-------|----------|
| Cannot connect from Render | Use **Transaction Pooler** (port 6543), not Direct Connection |
| `ENOIDENTIFIER` error | Add `?sslmode=require` to connection string |
| Tables not created | Check logs for `init_db()` errors; ensure `DATABASE_URL` is set |

#### Deploy Issues
| Issue | Solution |
|-------|----------|
| Build succeeds but deploy fails | Check Render logs for runtime errors |
| Health check fails | Ensure `/health` endpoint returns 200; check `WEB_CONCURRENCY` |
| Auto-deploy not triggering | Check GitHub webhook in Render settings |

### Database Issues

#### Supabase
| Issue | Solution |
|-------|----------|
| Tables not appearing | Make an API call to trigger `init_db()` (POST to `/api/v1/entries`) |
| Connection pool exhausted | Use Transaction Pooler (port 6543); limit connections |
| Migrations not running | Check `init_db()` has proper `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| Data not persisting | Ensure `DATABASE_URL` points to Supabase, not local SQLite |

#### Local SQLite (Dev)
| Issue | Solution |
|-------|----------|
| Database locked | Ensure only one process accesses `.db` file |
| Migration failed | Delete `.db` file and restart; auto-migrations will run |

### Frontend-Backend Integration

#### CORS Errors
| Error | Solution |
|-------|----------|
| `Access-Control-Allow-Origin` missing | Backend `CORS(app, origins=["https://prashant0731.github.io"])` |
| Preflight fails | Ensure `OPTIONS` method allowed; Flask-CORS handles this |

#### API Format Mismatches
| Issue | Solution |
|-------|----------|
| Field name mismatch | Check `row_to_dict` returns `tyreType` not `tyre_type` |
| Date format | Backend returns ISO string; frontend expects ISO |
| Photo base64 too large | Compress images client-side before upload (already implemented) |

### Deployment Issues

#### GitHub Pages
| Issue | Solution |
|-------|----------|
| 404 on all routes | Enable GitHub Pages → Source: "GitHub Actions" |
| Assets 404 | `vite.config.ts` `base: '/dharam-kaanta/'` matches repo name |
| Routing broken | `BrowserRouter basename="/dharam-kaanta"` matches `vite.config.ts` `base` |

#### Render
| Issue | Solution |
|-------|----------|
| Service spins down | Free tier spins down after inactivity; first request takes ~50s |
| Disk not mounting | Upgrade to Starter ($7/mo) for persistent disks; or use Supabase |
| Environment variable not read | Restart service after adding env vars; check spelling |

---

## 📞 Getting Help

1. **Check Logs First**
   - Frontend: Browser DevTools (F12) → Console/Network
   - Backend: Render Dashboard → Logs
   - Database: Supabase Dashboard → Logs

2. **Common Commands**
   ```bash
   # Frontend build test
   cd frontend && npm run build
   
   # Backend test locally
   cd backend && DATABASE_URL="postgresql://..." python flask_app.py
   
   # Check TypeScript
   cd frontend && npx tsc --noEmit
   
   # Check API
   curl https://dharam-kaanta.onrender.com/health
   ```

2. **Check Common Issues First**
   - [ ] `DATABASE_URL` set in Render?
   - [ ] `RENDER_BACKEND_URL` secret in GitHub?
   - [ ] GitHub Pages source = "GitHub Actions"?
   - [ ] Supabase Transaction Pooler URL used?
   - [ ] `sslmode=require` in connection string?

3. **Still Stuck?**
   - Check GitHub Issues
   - Review Render/Supabase status pages
   - Verify all environment variables match exactly

---

## 📝 License

MIT License - Free to use and modify.