from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime
from io import BytesIO
import uuid

from app.core.database import get_db
from app.models.entry import WeighbridgeEntry
from app.schemas.entry import ExportRequest

router = APIRouter()

def get_filtered_entries(
    db: Session,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    vehicle_filter: Optional[str] = None
):
    query = db.query(WeighbridgeEntry)
    
    if vehicle_filter:
        query = query.filter(WeighbridgeEntry.vehicle.ilike(f"%{vehicle_filter}%"))
    
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.filter(WeighbridgeEntry.created_at >= dt)
        except ValueError:
            pass
    
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.filter(WeighbridgeEntry.created_at <= dt)
        except ValueError:
            pass
    
    return query.order_by(WeighbridgeEntry.created_at.desc()).all()

@router.get("/export")
def export_data(
    format: str = Query(..., pattern="^(excel|pdf|word)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    vehicle_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    entries = get_filtered_entries(db, date_from, date_to, vehicle_filter)
    
    if not entries:
        raise HTTPException(status_code=404, detail="No data to export")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"dharam_kaanta_{timestamp}"
    
    if format == "excel":
        return export_excel(entries, filename)
    elif format == "pdf":
        return export_pdf(entries, filename)
    elif format == "word":
        return export_word(entries, filename)

def export_excel(entries: List[WeighbridgeEntry], filename: str):
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Entries"
    
    # Headers
    headers = ['S.No', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 
               'Rupees', 'Vehicle Photo', 'Gross Photo', 'Status', 'Created At']
    
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="17202A", end_color="17202A", fill_type="solid")
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    
    # Data
    for row_idx, entry in enumerate(entries, 2):
        ws.cell(row=row_idx, column=1, value=row_idx - 1)
        ws.cell(row=row_idx, column=2, value=entry.vehicle or "")
        ws.cell(row=row_idx, column=3, value=entry.tare or "")
        ws.cell(row=row_idx, column=4, value=entry.gross or "")
        ws.cell(row=row_idx, column=5, value=entry.net if entry.net else "")
        ws.cell(row=row_idx, column=6, value=round(entry.money, 2) if entry.money else "")
        ws.cell(row=row_idx, column=7, value="Yes" if entry.vehicle_photo else "No")
        ws.cell(row=row_idx, column=8, value="Yes" if entry.gross_photo else "No")
        ws.cell(row=row_idx, column=9, value="Saved" if entry.saved else "Draft")
        ws.cell(row=row_idx, column=10, value=entry.created_at.strftime("%d-%m-%Y %H:%M") if entry.created_at else "")
    
    # Auto-width columns
    column_widths = [8, 20, 14, 14, 14, 14, 16, 16, 12, 22]
    for i, width in enumerate(column_widths, 1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = width
    
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'}
    )

def export_pdf(entries: List[WeighbridgeEntry], filename: str):
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
    
    # Headers
    headers = ['S.No', 'Vehicle', 'Tare', 'Gross', 'Net', 'Rupees', 'V-Photo', 'G-Photo', 'Status', 'Created']
    col_widths = [10, 35, 18, 18, 18, 18, 16, 16, 16, 30]
    
    # Header row
    pdf.set_fill_color(23, 32, 42)
    pdf.set_text_color(255, 255, 255)
    for i, header in enumerate(headers):
        pdf.cell(col_widths[i], 7, header, 1, 0, 'C', True)
    pdf.ln()
    
    # Data rows
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', '', 7)
    fill = False
    for idx, entry in enumerate(entries):
        if fill:
            pdf.set_fill_color(243, 245, 247)
        else:
            pdf.set_fill_color(255, 255, 255)
        
        pdf.cell(col_widths[0], 6, str(idx + 1), 1, 0, 'C', True)
        pdf.cell(col_widths[1], 6, entry.vehicle or "-", 1, 0, 'L', True)
        pdf.cell(col_widths[2], 6, entry.tare or "-", 1, 0, 'C', True)
        pdf.cell(col_widths[3], 6, entry.gross or "-", 1, 0, 'C', True)
        pdf.cell(col_widths[4], 6, str(entry.net) if entry.net else "-", 1, 0, 'C', True)
        pdf.cell(col_widths[5], 6, f"{entry.money:.2f}" if entry.money else "-", 1, 0, 'C', True)
        pdf.cell(col_widths[6], 6, "Yes" if entry.vehicle_photo else "No", 1, 0, 'C', True)
        pdf.cell(col_widths[7], 6, "Yes" if entry.gross_photo else "No", 1, 0, 'C', True)
        pdf.cell(col_widths[8], 6, "Saved" if entry.saved else "Draft", 1, 0, 'C', True)
        pdf.cell(col_widths[9], 6, entry.created_at.strftime("%d-%m-%Y %H:%M") if entry.created_at else "-", 1, 0, 'C', True)
        pdf.ln()
        fill = not fill
    
    buffer = BytesIO()
    pdf.output(buffer)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'}
    )

def export_word(entries: List[WeighbridgeEntry], filename: str):
    from docx import Document
    from docx.shared import Inches, Pt, Cm
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml.ns import qn
    
    doc = Document()
    
    # Set landscape orientation
    for section in doc.sections:
        section.orientation = 1  # WD_ORIENT.LANDSCAPE
        section.page_width = Inches(11.69)
        section.page_height = Inches(8.27)
    
    # Title
    title = doc.add_heading('Dharam Kaanta - Weighbridge Entries', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Subtitle
    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = sub.add_run(f'Generated: {datetime.now().strftime("%d-%m-%Y %H:%M")} | Total Entries: {len(entries)}')
    run.font.size = Pt(10)
    
    # Table
    table = doc.add_table(rows=1, cols=10)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Headers
    headers = ['S.No', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 
               'Rupees', 'Vehicle Photo', 'Gross Photo', 'Status', 'Created At']
    hdr_cells = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr_cells[i].text = header
        for paragraph in hdr_cells[i].paragraphs:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:
                run.bold = True
                run.font.size = Pt(8)
                run.font.color.rgb = None  # Will be white via shading
    
    # Data
    for idx, entry in enumerate(entries):
        row_cells = table.add_row().cells
        row_cells[0].text = str(idx + 1)
        row_cells[1].text = entry.vehicle or "-"
        row_cells[2].text = entry.tare or "-"
        row_cells[3].text = entry.gross or "-"
        row_cells[4].text = str(entry.net) if entry.net else "-"
        row_cells[5].text = f"{entry.money:.2f}" if entry.money else "-"
        row_cells[6].text = "Yes" if entry.vehicle_photo else "No"
        row_cells[7].text = "Yes" if entry.gross_photo else "No"
        row_cells[8].text = "Saved" if entry.saved else "Draft"
        row_cells[9].text = entry.created_at.strftime("%d-%m-%Y %H:%M") if entry.created_at else "-"
        
        for cell in row_cells:
            for paragraph in cell.paragraphs:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in paragraph.runs:
                    run.font.size = Pt(8)
    
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}.docx"'}
    )