from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import sqlite3
import uuid
import json
import base64
from datetime import datetime, date
from io import BytesIO

app = Flask(__name__)
CORS(app)

DB_PATH = "dharam_kaanta.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
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
        conn.execute("ALTER TABLE entries ADD COLUMN tyre_type TEXT DEFAULT 'Radial'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def calc_net_money(tare, gross):
    t = float(tare) if tare else 0
    g = float(gross) if gross else 0
    net = g - t if (t or g) else 0
    money = round(net / 5, 2) if net else 0
    return net, money

def row_to_dict(row):
    return {
        "id": row["id"],
        "sno": row["sno"],
        "tyreType": row["tyre_type"] or "Radial",
        "vehicle": row["vehicle"],
        "tare": row["tare"],
        "gross": row["gross"],
        "net": row["net"],
        "money": row["money"],
        "vehiclePhoto": row["vehicle_photo"],
        "grossPhoto": row["gross_photo"],
        "saved": bool(row["saved"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }

@app.route("/")
def root():
    return jsonify({"name": "Dharam Kaanta API", "version": "1.0.0", "docs": "/docs"})

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/api/v1/entries", methods=["GET"])
def get_entries():
    skip = int(request.args.get("skip", 0))
    limit = int(request.args.get("limit", 100))
    search = request.args.get("search")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    
    conn = get_db()
    query = "SELECT * FROM entries WHERE 1=1"
    params = []
    
    if search:
        query += " AND vehicle LIKE ?"
        params.append(f"%{search}%")
    if date_from:
        query += " AND created_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND created_at <= ?"
        params.append(date_to)
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, skip])
    
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/v1/entries/<entry_id>", methods=["GET"])
def get_entry(entry_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
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
    conn.execute("""
        INSERT INTO entries (id, sno, vehicle, tare, gross, net, money, vehicle_photo, gross_photo, saved, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (entry_id, data["sno"], data.get("vehicle"), data.get("tare"), data.get("gross"),
          net, money, data.get("vehiclePhoto"), data.get("grossPhoto"), 0, now, now))
    conn.commit()
    
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201

@app.route("/api/v1/entries/<entry_id>", methods=["PUT"])
def update_entry(entry_id):
    data = request.get_json()
    conn = get_db()
    existing = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Entry not found"}), 404
    
    net, money = calc_net_money(
        data.get("tare", existing["tare"]),
        data.get("gross", existing["gross"])
    )
    
    update_fields = []
    params = []
    for field in ["vehicle", "tare", "gross", "vehicle_photo", "gross_photo", "saved"]:
        if field in data:
            update_fields.append(f"{field} = ?")
            val = data[field]
            if field == "saved":
                val = 1 if val else 0
            params.append(val)
    
    update_fields.append("net = ?")
    params.append(net)
    update_fields.append("money = ?")
    params.append(money)
    update_fields.append("updated_at = ?")
    params.append(datetime.now().isoformat())
    params.append(entry_id)
    
    conn.execute(f"UPDATE entries SET {', '.join(update_fields)} WHERE id = ?", params)
    conn.commit()
    
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row))

@app.route("/api/v1/entries/<entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    conn = get_db()
    conn.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Entry deleted"})

@app.route("/api/v1/entries/bulk", methods=["POST"])
def bulk_create():
    entries = request.get_json()
    created_ids = []
    now = datetime.now().isoformat()
    
    conn = get_db()
    for entry in entries:
        net, money = calc_net_money(entry.get("tare"), entry.get("gross"))
        entry_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO entries (id, sno, vehicle, tare, gross, net, money, vehicle_photo, gross_photo, saved, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (entry_id, entry["sno"], entry.get("vehicle"), entry.get("tare"), entry.get("gross"),
              net, money, entry.get("vehiclePhoto"), entry.get("grossPhoto"), 0, now, now))
        created_ids.append(entry_id)
    conn.commit()
    
    placeholders = ",".join("?" * len(created_ids))
    rows = conn.execute(f"SELECT * FROM entries WHERE id IN ({placeholders})", created_ids).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/v1/stats", methods=["GET"])
def get_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    saved = conn.execute("SELECT COUNT(*) FROM entries WHERE saved = 1").fetchone()[0]
    today = conn.execute("SELECT COUNT(*) FROM entries WHERE date(created_at) = date('now')").fetchone()[0]
    total_weight = conn.execute("SELECT COALESCE(SUM(net), 0) FROM entries").fetchone()[0]
    total_revenue = conn.execute("SELECT COALESCE(SUM(money), 0) FROM entries").fetchone()[0]
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
    query = "SELECT * FROM entries WHERE 1=1"
    params = []
    
    if vehicle_filter:
        query += " AND vehicle LIKE ?"
        params.append(f"%{vehicle_filter}%")
    if date_from:
        query += " AND created_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND created_at <= ?"
        params.append(date_to)
    
    query += " ORDER BY created_at DESC"
    entries = [row_to_dict(r) for r in conn.execute(query, params).fetchall()]
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
    
    # Add image columns
    headers = ['S.No', 'Tyre Type', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 
               'Amount', 'Vehicle Photo', 'Gross Photo', 'Status', 'Created At']
    
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="17202A", end_color="17202A", fill_type="solid")
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    
    # Set column widths for images
    ws.column_dimensions['H'].width = 18  # Vehicle Photo
    ws.column_dimensions['I'].width = 18  # Gross Photo
    
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
                # Decode base64
                img_data = base64.b64decode(entry["vehiclePhoto"])
                pil_img = PILImage.open(BytesIO(img_data))
                
                # Resize for Excel (max 100px width)
                max_width = 100
                if pil_img.width > max_width:
                    ratio = max_width / pil_img.width
                    new_height = int(pil_img.height * ratio)
                    pil_img = pil_img.resize((max_width, new_height), PILImage.Resampling.LANCZOS)
                
                # Save to bytes
                img_buffer = BytesIO()
                pil_img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                
                # Add to Excel
                xl_img = XLImage(img_buffer)
                ws.add_image(xl_img, f'H{row_idx}')
                ws.row_dimensions[row_idx].height = 75  # Set row height for image
            except Exception as e:
                ws.cell(row=row_idx, column=8, value="Error loading image")
        
        # Embed Gross Photo
        if entry.get("grossPhoto"):
            try:
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
        
        # Status column
        ws.cell(row=row_idx, column=10, value="Saved" if entry["saved"] else "Draft")
        ws.cell(row=row_idx, column=11, value=entry["createdAt"] or "")
    
    # Set column widths
    widths = [8, 14, 18, 12, 12, 12, 12, 18, 18, 12, 22]
    for i, width in enumerate(widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = width
    
    # Style headers
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="17202A", end_color="17202A", fill_type="solid")
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
    
    headers = ['S.No', 'Vehicle', 'Tare', 'Gross', 'Net', 'Rupees', 'V-Photo', 'G-Photo', 'Status', 'Created']
    col_widths = [10, 35, 18, 18, 18, 18, 16, 16, 16, 30]
    
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
        pdf.cell(col_widths[1], 6, entry["vehicle"] or "-", 1, 0, 'L', True)
        pdf.cell(col_widths[2], 6, entry["tare"] or "-", 1, 0, 'C', True)
        pdf.cell(col_widths[3], 6, entry["gross"] or "-", 1, 0, 'C', True)
        pdf.cell(col_widths[4], 6, str(entry["net"]) if entry["net"] else "-", 1, 0, 'C', True)
        pdf.cell(col_widths[5], 6, f"{entry['money']:.2f}" if entry["money"] else "-", 1, 0, 'C', True)
        pdf.cell(col_widths[6], 6, "Yes" if entry["vehiclePhoto"] else "No", 1, 0, 'C', True)
        pdf.cell(col_widths[7], 6, "Yes" if entry["grossPhoto"] else "No", 1, 0, 'C', True)
        pdf.cell(col_widths[8], 6, "Saved" if entry["saved"] else "Draft", 1, 0, 'C', True)
        pdf.cell(col_widths[9], 6, entry["createdAt"] or "-", 1, 0, 'C', True)
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
    
    table = doc.add_table(rows=1, cols=10)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    headers = ['S.No', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 
               'Rupees', 'Vehicle Photo', 'Gross Photo', 'Status', 'Created At']
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
        row[1].text = entry["vehicle"] or "-"
        row[2].text = entry["tare"] or "-"
        row[3].text = entry["gross"] or "-"
        row[4].text = str(entry["net"]) if entry["net"] else "-"
        row[5].text = f"{entry['money']:.2f}" if entry["money"] else "-"
        row[6].text = "Yes" if entry["vehiclePhoto"] else "No"
        row[7].text = "Yes" if entry["grossPhoto"] else "No"
        row[8].text = "Saved" if entry["saved"] else "Draft"
        row[9].text = entry["createdAt"] or "-"
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

if __name__ == "__main__":
    init_db()
    print("Starting Dharam Kaanta API on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=True)