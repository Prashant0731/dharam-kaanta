from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import os
import uuid
import json
import base64
from datetime import datetime, date
from io import BytesIO

# PostgreSQL support
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    USE_POSTGRES = True
except ImportError:
    USE_POSTGRES = False

# Google Sheets Sync
try:
    from sheets_sync import get_sheets_sync, init_sheets_sync
    SHEETS_SYNC_AVAILABLE = True
except ImportError:
    SHEETS_SYNC_AVAILABLE = False
    get_sheets_sync = None
    init_sheets_sync = None

import sqlite3
import uuid
import json
import base64
from datetime import datetime, date
from io import BytesIO

app = Flask(__name__)
CORS(app, origins=["https://prashant0731.github.io"])

# Database configuration - Use Supabase PostgreSQL if available, fallback to SQLite
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and USE_POSTGRES:
    # Use Supabase PostgreSQL
    DB_TYPE = "postgres"
    DB_PATH = None
else:
    # Fallback to SQLite for local development
    DB_TYPE = "sqlite"
    DB_PATH = os.getenv("DB_PATH", "dharam_kaanta.db")

def get_db():
    """Get database connection - PostgreSQL or SQLite"""
    if DB_TYPE == "postgres":
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        conn.autocommit = True
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    """Initialize database tables - works for both PostgreSQL and SQLite"""
    conn = get_db()
    cursor = conn.cursor()
    
    if DB_TYPE == "postgres":
        # PostgreSQL syntax
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                sno INTEGER NOT NULL,
                tyre_type TEXT DEFAULT 'Radial',
                vehicle TEXT,
                tare TEXT,
                gross TEXT,
                net REAL DEFAULT 0,
                money REAL DEFAULT 0,
                vehicle_photo TEXT,
                gross_photo TEXT,
                saved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Migration: Add tyre_type column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE entries ADD COLUMN IF NOT EXISTS tyre_type TEXT DEFAULT 'Radial'")
        except Exception:
            pass  # Column already exists
    else:
        # SQLite syntax
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                sno INTEGER NOT NULL,
                tyre_type TEXT DEFAULT 'Radial',
                vehicle TEXT,
                tare TEXT,
                gross TEXT,
                net REAL DEFAULT 0,
                money REAL DEFAULT 0,
                vehicle_photo TEXT,
                gross_photo TEXT,
                saved INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Migration: Add tyre_type column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE entries ADD COLUMN tyre_type TEXT DEFAULT 'Radial'")
        except sqlite3.OperationalError:
            pass  # Column already exists
    
    conn.commit()
    conn.close()

def calc_net_money(tare, gross):
    t = float(tare) if tare else 0
    g = float(gross) if gross else 0
    net = g - t if (t or g) else 0
    money = round(net / 5, 2) if net else 0
    return net, money

def row_to_dict(row):
    if DB_TYPE == "postgres":
        # RealDictCursor already returns dict-like object
        d = dict(row)
    else:
        d = {
            "id": row["id"],
            "sno": row["sno"],
            "tyre_type": row["tyre_type"] or "Radial",
            "vehicle": row["vehicle"],
            "tare": row["tare"],
            "gross": row["gross"],
            "net": row["net"],
            "money": row["money"],
            "vehicle_photo": row["vehicle_photo"],
            "gross_photo": row["gross_photo"],
            "saved": bool(row["saved"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
    # Ensure consistent field names
    return {
        "id": d.get("id"),
        "sno": d.get("sno"),
        "tyreType": d.get("tyre_type") or d.get("tyreType") or "Radial",
        "vehicle": d.get("vehicle"),
        "tare": d.get("tare"),
        "gross": d.get("gross"),
        "net": d.get("net"),
        "money": d.get("money"),
        "vehiclePhoto": d.get("vehicle_photo") or d.get("vehiclePhoto"),
        "grossPhoto": d.get("gross_photo") or d.get("grossPhoto"),
        "saved": d.get("saved"),
        "createdAt": d.get("createdAt") or d.get("created_at"),
        "updatedAt": d.get("updatedAt") or d.get("updated_at"),
    }

# ... rest of the file remains the same
@app.route("/")
def root():
    return jsonify({"name": "Dharam Kaanta API", "version": "1.0.0", "docs": "/docs"})

@app.route("/health")
def health():
    return jsonify({"status": "ok", "db_type": DB_TYPE})

@app.route("/api/v1/entries", methods=["GET"])
def get_entries():
    skip = int(request.args.get("skip", 0))
    limit = int(request.args.get("limit", 100))
    search = request.args.get("search")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM entries WHERE 1=1"
    params = []
    
    if search:
        query += " AND vehicle ILIKE %s"
        params.append(f"%{search}%")
    if date_from:
        query += " AND created_at >= %s"
        params.append(date_from)
    if date_to:
        query += " AND created_at <= %s"
        params.append(date_to)
    
    query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, skip])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/v1/entries/<entry_id>", methods=["GET"])
def get_entry(entry_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM entries WHERE id = %s", (entry_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify(row_to_dict(row))

@app.route("/api/v1/entries", methods=["POST"])
def create_entry():
    data = request.get_json()
    net, money = calc_net_money(data.get("tare"), data.get("gross"))
    entry_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO entries (id, sno, tyre_type, vehicle, tare, gross, net, money, vehicle_photo, gross_photo, saved, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (entry_id, data["sno"], data.get("tyre_type", "Radial"), data.get("vehicle"), data.get("tare"), data.get("gross"),
          net, money, data.get("vehiclePhoto"), data.get("grossPhoto"), False, now, now))
    conn.commit()
    
    cursor.execute("SELECT * FROM entries WHERE id = %s", (entry_id,))
    row = cursor.fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201

@app.route("/api/v1/entries/<entry_id>", methods=["PUT"])
def update_entry(entry_id):
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()
    existing = cursor.execute("SELECT * FROM entries WHERE id = %s", (entry_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Entry not found"}), 404
    
    net, money = calc_net_money(
        data.get("tare", existing["tare"]),
        data.get("gross", existing["gross"])
    )
    
    update_fields = []
    params = []
    for field in ["tyre_type", "vehicle", "tare", "gross", "vehicle_photo", "gross_photo", "saved"]:
        if field in data:
            update_fields.append(f"{field} = %s")
            val = data[field]
            if field == "saved":
                val = val if DB_TYPE == "postgres" else (1 if val else 0)
            params.append(val)
    
    update_fields.append("net = %s")
    params.append(net)
    update_fields.append("money = %s")
    params.append(money)
    update_fields.append("updated_at = %s")
    params.append(datetime.now().isoformat())
    params.append(entry_id)
    
    cursor.execute(f"UPDATE entries SET {', '.join(update_fields)} WHERE id = %s", params)
    conn.commit()
    
    cursor.execute("SELECT * FROM entries WHERE id = %s", (entry_id,))
    row = cursor.fetchone()
    conn.close()
    return jsonify(row_to_dict(row))

@app.route("/api/v1/entries/<entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM entries WHERE id = %s", (entry_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Entry deleted"})

@app.route("/api/v1/entries/bulk", methods=["POST"])
def bulk_create():
    entries = request.get_json()
    created_ids = []
    now = datetime.now().isoformat()
    
    conn = get_db()
    cursor = conn.cursor()
    for entry in entries:
        net, money = calc_net_money(entry.get("tare"), entry.get("gross"))
        entry_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO entries (id, sno, tyre_type, vehicle, tare, gross, net, money, vehicle_photo, gross_photo, saved, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (entry_id, entry["sno"], entry.get("tyre_type", "Radial"), entry.get("vehicle"), entry.get("tare"), entry.get("gross"),
              net, money, entry.get("vehiclePhoto"), entry.get("grossPhoto"), False, now, now))
        created_ids.append(entry_id)
    conn.commit()
    
    placeholders = ",".join(["%s"] * len(created_ids))
    cursor.execute(f"SELECT * FROM entries WHERE id IN ({placeholders})", created_ids)
    rows = cursor.fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/v1/stats", methods=["GET"])
def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    total = cursor.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    saved = cursor.execute("SELECT COUNT(*) FROM entries WHERE saved = %s", (True if DB_TYPE == "postgres" else 1,)).fetchone()[0]
    today = cursor.execute("SELECT COUNT(*) FROM entries WHERE DATE(created_at) = CURRENT_DATE").fetchone()[0]
    total_weight = cursor.execute("SELECT COALESCE(SUM(net), 0) FROM entries").fetchone()[0]
    total_revenue = cursor.execute("SELECT COALESCE(SUM(money), 0) FROM entries").fetchone()[0]
    conn.close()
    
    return jsonify({
        "totalEntries": total, "savedEntries": saved, "todayEntries": today,
        "totalWeight": total_weight, "totalRevenue": total_revenue
    })

# Export endpoints
@app.route("/api/v1/export", methods=["GET"])
def export_data():
    format = request.args.get("format")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    vehicle_filter = request.args.get("vehicle_filter")
    
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT * FROM entries WHERE 1=1"
    params = []
    
    if vehicle_filter:
        query += " AND vehicle ILIKE %s"
        params.append(f"%{vehicle_filter}%")
    if date_from:
        query += " AND created_at >= %s"
        params.append(date_from)
    if date_to:
        query += " AND created_at <= %s"
        params.append(date_to)
    
    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    entries = [row_to_dict(r) for r in cursor.fetchall()]
    conn.close()
    
    if not entries:
        return jsonify({"error": "No data to export"}), 404
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"dharam_kaanta_{timestamp}"
    
    if format == "excel":
        return export_excel(entries, filename)
    elif format == "pdf":
        return export_pdf(entries, filename)
    elif format == "word":
        return export_word(entries, filename)
    else:
        return jsonify({"error": "Invalid format"}), 400

def export_excel(entries, filename):
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.drawing.image import Image as XLImage
    from PIL import Image as PILImage
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Entries"
    
    headers = ['S.No', 'Tyre Type', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 
               'Amount', 'Vehicle Photo', 'Gross Photo', 'Status', 'Created At']
    
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="17202A", end_color="17202A", fill_type="solid")
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    
    ws.column_dimensions['H'].width = 18
    ws.column_dimensions['I'].width = 18
    
    for row_idx, entry in enumerate(entries, 2):
        ws.cell(row=row_idx, column=1, value=row_idx - 1)
        ws.cell(row=row_idx, column=2, value=entry.get("tyreType") or "")
        ws.cell(row=row_idx, column=3, value=entry["vehicle"] or "")
        ws.cell(row=row_idx, column=4, value=entry["tare"] or "")
        ws.cell(row=row_idx, column=5, value=entry["gross"] or "")
        ws.cell(row=row_idx, column=6, value=entry["net"] if entry["net"] else "")
        ws.cell(row=row_idx, column=7, value=round(entry["money"], 2) if entry["money"] else "")
        ws.cell(row=row_idx, column=10, value="Saved" if entry["saved"] else "Draft")
        ws.cell(row=row_idx, column=11, value=entry["createdAt"] or "")
        
        # Embed Vehicle Photo
        if entry.get("vehiclePhoto"):
            try:
                import base64
                img_data = base64.b64decode(entry["vehiclePhoto"])
                pil_img = PILImage.open(BytesIO(img_data))
                
                max_width = 100
                if pil_img.width > max_width:
                    ratio = max_width / pil_img.width
                    new_height = int(pil_img.height * ratio)
                    pil_img = pil_img.resize((max_width, new_height), PILImage.Resampling.LANCZOS)
                
                img_buffer = BytesIO()
                pil_img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                
                xl_img = XLImage(img_buffer)
                ws.add_image(xl_img, f'H{row_idx}')
                ws.row_dimensions[row_idx].height = 75
            except Exception as e:
                ws.cell(row=row_idx, column=8, value="Error loading image")
        
        if entry.get("grossPhoto"):
            try:
                import base64
                img_data = base64.b64decode(entry["grossPhoto"])
                pil_img = PILImage.open(BytesIO(img_data))
                
                max_width = 100
                if pil_img.width > max_width:
                    ratio = max_width / pil_img.width
                    new_height = int(pil_img.height * ratio)
                    pil_img = pil_img.resize((max_width, new_height), PILImage.Resampling.LANCZOS)
                
                img_buffer = BytesIO()
                pil_img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                
                xl_img = XLImage(img_buffer)
                ws.add_image(xl_img, f'I{row_idx}')
            except Exception as e:
                ws.cell(row=row_idx, column=9, value="Error loading image")
        
        ws.cell(row=row_idx, column=10, value="Saved" if entry["saved"] else "Draft")
        ws.cell(row=row_idx, column=11, value=entry["createdAt"] or "")
    
    widths = [8, 14, 18, 12, 12, 12, 12, 18, 18, 12, 22]
    for i, width in enumerate(widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = width
    
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="17202A", end_color="17202A", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")
    
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    return send_file(buffer, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                     as_attachment=True, download_name=f"{filename}.xlsx")

def export_pdf(entries, filename):
    from fpdf import FPDF
    
    class PDF(FPDF):
        def header(self):
            self.set_font('Helvetica', 'B', 16)
            self.cell(0, 10, 'Dharam Kaanta - Weighbridge Entries', 0, 1, 'C')
            self.set_font('Helvetica', '', 8)
            self.cell(0, 5, f'Generated: {datetime.now().strftime("%d-%m-%Y %H:%M")}', 0, 1, 'C')
            self.cell(0, 5, f'Total Entries: {len(entries)}', 0, 1, 'C')
            self.ln(5)
    
    pdf = PDF('L', 'mm', 'A4')
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 7)
    
    headers = ['S.No', 'Tyre Type', 'Vehicle', 'Tare', 'Gross', 'Net', 'Amount', 'V-Photo', 'G-Photo', 'Status', 'Created']
    col_widths = [10, 22, 35, 18, 18, 18, 18, 16, 16, 16, 30]
    
    pdf.set_fill_color(23, 32, 42)
    pdf.set_text_color(255, 255, 255)
    for i, header in enumerate(headers):
        pdf.cell(col_widths[i], 7, header, 1, 0, 'C', True)
    pdf.ln()
    
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', '', 7)
    fill = False
    for idx, entry in enumerate(entries):
        pdf.set_fill_color(243, 245, 247) if fill else pdf.set_fill_color(255, 255, 255)
        
        pdf.cell(col_widths[0], 6, str(idx + 1), 1, 0, 'C', True)
        pdf.cell(col_widths[1], 6, entry.get("tyreType") or "-", 1, 0, 'L', True)
        pdf.cell(col_widths[2], 6, entry["vehicle"] or "-", 1, 0, 'L', True)
        pdf.cell(col_widths[3], 6, entry["tare"] or "-", 1, 0, 'C', True)
        pdf.cell(col_widths[4], 6, entry["gross"] or "-", 1, 0, 'C', True)
        pdf.cell(col_widths[5], 6, str(entry["net"]) if entry["net"] else "-", 1, 0, 'C', True)
        pdf.cell(col_widths[6], 6, f"{entry['money']:.2f}" if entry["money"] else "-", 1, 0, 'C', True)
        pdf.cell(col_widths[7], 6, "Yes" if entry.get("vehiclePhoto") else "No", 1, 0, 'C', True)
        pdf.cell(col_widths[8], 6, "Yes" if entry.get("grossPhoto") else "No", 1, 0, 'C', True)
        pdf.cell(col_widths[9], 6, "Saved" if entry["saved"] else "Draft", 1, 0, 'C', True)
        pdf.cell(col_widths[10], 6, entry.get("createdAt") or "-", 1, 0, 'C', True)
        pdf.ln()
        fill = not fill
    
    buffer = BytesIO()
    pdf.output(buffer)
    buffer.seek(0)
    
    return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name=f"{filename}.pdf")

def export_word(entries, filename):
    from docx import Document
    from docx.shared import Inches, Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    
    doc = Document()
    for section in doc.sections:
        section.orientation = 1
        section.page_width = Inches(11.69)
        section.page_height = Inches(8.27)
    
    title = doc.add_heading('Dharam Kaanta - Weighbridge Entries', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = sub.add_run(f'Generated: {datetime.now().strftime("%d-%m-%Y %H:%M")} | Total Entries: {len(entries)}')
    run.font.size = Pt(10)
    
    table = doc.add_table(rows=1, cols=11)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    headers = ['S.No', 'Tyre Type', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 
               'Amount', 'Vehicle Photo', 'Gross Photo', 'Status', 'Created At']
    for i, header in enumerate(headers):
        table.rows[0].cells[i].text = header
        for p in table.rows[0].cells[i].paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(8)
    
    for idx, entry in enumerate(entries):
        row = table.add_row().cells
        row[0].text = str(idx + 1)
        row[1].text = entry.get("tyreType") or "-"
        row[2].text = entry["vehicle"] or "-"
        row[3].text = entry["tare"] or "-"
        row[4].text = entry["gross"] or "-"
        row[5].text = str(entry["net"]) if entry["net"] else "-"
        row[6].text = f"{entry['money']:.2f}" if entry["money"] else "-"
        row[7].text = "Yes" if entry.get("vehiclePhoto") else "No"
        row[8].text = "Yes" if entry.get("grossPhoto") else "No"
        row[9].text = "Saved" if entry["saved"] else "Draft"
        row[10].text = entry.get("createdAt") or "-"
        for cell in row:
            for p in cell.paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for r in p.runs:
                    r.font.size = Pt(8)
    
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    
    return send_file(buffer, mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                     as_attachment=True, download_name=f"{filename}.docx")

# Initialize Google Sheets Sync on startup
if SHEETS_SYNC_AVAILABLE:
    init_sheets_sync()

# Google Sheets Sync Endpoints
@app.route("/api/v1/sheets/sync", methods=["POST"])
def sync_to_sheets():
    """Sync all entries to Google Sheets"""
    if not SHEETS_SYNC_AVAILABLE:
        return jsonify({"success": False, "error": "Google Sheets sync not available"}), 503
    
    sheets_sync = get_sheets_sync()
    if not sheets_sync or not sheets_sync.is_enabled():
        return jsonify({"success": False, "error": "Google Sheets sync not configured. Set GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEETS_SPREADSHEET_ID environment variables."}), 503
    
    # Get all entries from database
    conn = get_db()
    cursor = conn.cursor()
    
    if DB_TYPE == "postgres":
        cursor.execute("SELECT * FROM entries ORDER BY created_at DESC")
    else:
        cursor.execute("SELECT * FROM entries ORDER BY created_at DESC")
    
    rows = cursor.fetchall()
    conn.close()
    
    # Convert to list of dicts
    entries = [row_to_dict(r) for r in rows]
    
    # Sync to sheets
    result = sheets_sync.sync_all(entries)
    
    if result.get('success'):
        return jsonify(result), 200
    else:
        return jsonify(result), 500


@app.route("/api/v1/sheets/status", methods=["GET"])
def sheets_status():
    """Get Google Sheets sync status"""
    if not SHEETS_SYNC_AVAILABLE:
        return jsonify({"enabled": False, "error": "Google Sheets sync not available"})
    
    sheets_sync = get_sheets_sync()
    if not sheets_sync:
        return jsonify({"enabled": False, "error": "Not initialized"})
    
    return jsonify({
        "enabled": sheets_sync.is_enabled(),
        "spreadsheet_id": sheets_sync.spreadsheet_id,
        "sheet_name": sheets_sync.sheet_name
    })


@app.route("/api/v1/sheets/test", methods=["POST"])
def test_sheets_connection():
    """Test Google Sheets connection"""
    if not SHEETS_SYNC_AVAILABLE:
        return jsonify({"success": False, "error": "Google Sheets sync not available"}), 503
    
    sheets_sync = get_sheets_sync()
    if not sheets_sync or not sheets_sync.is_enabled():
        return jsonify({"success": False, "error": "Google Sheets sync not configured"}), 503
    
    # Try to ensure sheet exists
    try:
        success = sheets_sync._ensure_sheet_exists()
        if success:
            return jsonify({"success": True, "message": "Connection successful, sheet ready"})
        else:
            return jsonify({"success": False, "error": "Failed to create/access sheet"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    init_db()
    print(f"Starting Dharam Kaanta API on http://localhost:8000 (DB: {DB_TYPE})")
    app.run(host="0.0.0.0", port=8000, debug=True)