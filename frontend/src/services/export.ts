import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { WeighbridgeEntry } from '../types';

export function exportToExcel(entries: WeighbridgeEntry[], filename = 'dharam-kaanta-entries') {
  const data = entries.map((e, i) => ({
    'S.No': i + 1,
    'Vehicle No.': e.vehicle,
    'Tare (kg)': e.tare,
    'Gross (kg)': e.gross,
    'Net (kg)': e.net,
    'Amount': e.money,
    'Vehicle Photo (Base64)': e.vehiclePhoto || '',
    'Gross Photo (Base64)': e.grossPhoto || '',
    'Vehicle Photo': e.vehiclePhoto ? 'Yes' : 'No',
    'Gross Photo': e.grossPhoto ? 'Yes' : 'No',
    'Status': e.saved ? 'Saved' : 'Draft',
    'Created At': e.createdAt ? new Date(e.createdAt).toLocaleString('en-IN') : '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Entries');
  
  // Auto-width columns
  const cols = [
    { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, 
    { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 50 }, 
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 22 }
  ];
  ws['!cols'] = cols;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(entries: WeighbridgeEntry[], filename = 'dharam-kaanta-entries') {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Dharam Kaanta - Weighbridge Entries', 14, 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 22);
  doc.text(`Total Entries: ${entries.length}`, 14, 28);

  const tableData = entries.map((e, i) => [
    (i + 1).toString(),
    e.vehicle,
    e.tare,
    e.gross,
    e.net.toString(),
    e.money.toFixed(2),
    e.vehiclePhoto ? 'Yes' : 'No',
    e.grossPhoto ? 'Yes' : 'No',
    e.saved ? 'Saved' : 'Draft',
    e.createdAt ? new Date(e.createdAt).toLocaleString('en-IN') : '',
  ]);

  autoTable(doc, {
    head: [['S.No', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 'Rupees', 'Veh Photo', 'Gross Photo', 'Status', 'Created At']],
    body: tableData,
    startY: 35,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [23, 32, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [243, 245, 247] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 },
      8: { cellWidth: 18 },
      9: { cellWidth: 35 },
    },
    margin: { left: 10, right: 10 },
  });

  doc.save(`${filename}.pdf`);
}

export async function exportToWord(entries: WeighbridgeEntry[], filename = 'dharam-kaanta-entries') {
  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        'S.No', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 
        'Rupees', 'Vehicle Photo', 'Gross Photo', 'Status', 'Created At'
      ].map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })] })],
        shading: { fill: '17202A' },
      })),
    }),
  ];

  entries.forEach((e, i) => {
    tableRows.push(new TableRow({
      children: [
        (i + 1).toString(),
        e.vehicle,
        e.tare,
        e.gross,
        e.net.toString(),
        e.money.toFixed(2),
        e.vehiclePhoto ? 'Yes' : 'No',
        e.grossPhoto ? 'Yes' : 'No',
        e.saved ? 'Saved' : 'Draft',
        e.createdAt ? new Date(e.createdAt).toLocaleString('en-IN') : '',
      ].map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
      })),
    }));
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Dharam Kaanta - Weighbridge Entries', bold: true, size: 36 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleString('en-IN')} | Total Entries: ${entries.length}`, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

export function exportAll(entries: WeighbridgeEntry[], format: 'excel' | 'pdf' | 'word') {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `dharam-kaanta-${timestamp}`;
  
  switch (format) {
    case 'excel':
      exportToExcel(entries, filename);
      break;
    case 'pdf':
      exportToPDF(entries, filename);
      break;
    case 'word':
      exportToWord(entries, filename);
      break;
  }
}