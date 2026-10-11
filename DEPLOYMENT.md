# Dharam Kaanta - Deployment Guide

## Architecture
- **Frontend**: React + TypeScript + Vite → GitHub Pages
- **Backend**: Flask + SQLite → Render (or Railway)
- **Database**: SQLite (file-based, persisted on Render disk)

---

## 1. Frontend Deployment (GitHub Pages)

### Prerequisites
- GitHub repository with this code
- GitHub Pages enabled in repository settings

### Steps

1. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"

2. **Add Repository Secrets**
   - Go to Settings → Secrets and variables → Actions
   - Add secret: `RENDER_BACKEND_URL` = `your-render-backend.onrender.com` (without https://)

3. **Push to main branch**
   - The GitHub Action will automatically build and deploy
   - Frontend will be available at: `https://<username>.github.io/<repo-name>/TL/`

### Local Development
```bash
cd frontend
npm install
npm run dev
```

---

## 2. Backend Deployment (Render)

### Option A: Using Render Dashboard (Recommended)

1. **Create Render Account**
   - Sign up at https://render.com

2. **Create New Web Service**
   - Connect your GitHub repository
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python flask_app.py`

3. **Environment Variables**
   - No special env vars needed (SQLite is file-based)

4. **Deploy**
   - Render will provide a URL like: `https://dharam-kaanta-api.onrender.com`

### Option B: Using render.yaml (Infrastructure as Code)

The `backend/render.yaml` file defines the service. Render can auto-detect it.

### Important: SQLite Persistence on Render
- By default, Render's filesystem is ephemeral
- For SQLite persistence, add a **Disk** in Render dashboard:
  - Name: `dharam-kaanta-data`
  - Mount Path: `/data`
  - Update `flask_app.py` DB_PATH to use `/data/dharam_kaanta.db`

---

## 3. Configuration

### Frontend API URL
Update `frontend/.env.production`:
```
VITE_API_URL=https://your-render-backend.onrender.com/api/v1
```

### Backend CORS
In `flask_app.py`, update CORS origins:
```python
CORS(app, origins=["https://your-github-username.github.io"])
```

---

## 4. Deployment Checklist

- [ ] GitHub Pages enabled
- [ ] `RENDER_BACKEND_URL` secret added
- [ ] Backend deployed to Render
- [ ] SQLite disk persistence configured (if needed)
- [ ] Frontend `.env.production` updated with backend URL
- [ ] Backend CORS updated with GitHub Pages URL
- [ ] Push to main triggers both deployments

---

## 5. Custom Domain (Optional)

### GitHub Pages Custom Domain
1. Add CNAME file to `frontend/public/CNAME` with your domain
2. Configure DNS: CNAME → `<username>.github.io`
3. Enable "Enforce HTTPS" in GitHub Pages settings

### Render Custom Domain
1. In Render dashboard → Settings → Custom Domains
2. Add your domain
3. Configure DNS as instructed

---

## 6. Database Backup (Important!)

Since SQLite is file-based, set up regular backups:

```bash
# On Render, you can use a cron job or external backup service
# Example: Daily backup to S3/GCS
```

---

## 7. Monitoring

- **GitHub Actions**: Check workflow runs in Actions tab
- **Render**: View logs in service dashboard
- **Health Check**: `https://your-backend.onrender.com/health`

---

## 8. Cost Estimation

- **GitHub Pages**: Free
- **Render Web Service**: Free tier (spins down after inactivity) or $7/month for always-on
- **Render Disk**: $0.25/GB/month (for SQLite persistence)

---

## 9. Troubleshooting

### Frontend not loading
- Check GitHub Actions logs
- Verify `base: '/TL/'` in vite.config.ts matches repo name
- Check browser console for API errors

### Backend not accessible
- Check Render logs
- Verify CORS settings
- Check health endpoint: `/health`

### API connection failed
- Verify `VITE_API_URL` in production build
- Check CORS headers in browser dev tools
- Ensure backend allows GitHub Pages origin

---

## 10. Rollback

### Frontend
- GitHub Pages: Re-deploy previous workflow run

### Backend
- Render: Manual deploy → select previous commit