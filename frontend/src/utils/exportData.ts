import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Export data to Excel with formatting
 */
export interface ExcelExportOptions {
  filename?: string;
  sheetName?: string;
  autoWidth?: boolean;
  freezePane?: boolean;
}

export const exportToExcel = async <T extends Record<string, any>>(
  data: T[],
  options: ExcelExportOptions = {}
) => {
  const {
    filename = 'export.xlsx',
    sheetName = 'Data',
    autoWidth = true,
    freezePane = true,
  } = options;

  // Prepare data
  const exportData = data.map(row => {
    const newRow: Record<string, any> = {};
    Object.entries(row).forEach(([key, value]) => {
      // Format dates
      if (value instanceof Date) {
        newRow[key] = value.toLocaleDateString();
      }
      // Format numbers
      else if (typeof value === 'number') {
        newRow[key] = Number(value.toFixed(2));
      }
      // Format booleans
      else if (typeof value === 'boolean') {
        newRow[key] = value ? 'Yes' : 'No';
      }
      // Format objects
      else if (typeof value === 'object' && value !== null) {
        newRow[key] = JSON.stringify(value);
      }
      // Keep strings as-is
      else {
        newRow[key] = value;
      }
    });
    return newRow;
  });

  const headers = Object.keys(exportData[0] || {});

  // Create workbook + worksheet
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);

  ws.columns = headers.map(key => ({
    header: key,
    key,
    width: autoWidth ? Math.max(key.length, 15) : 15,
  }));

  exportData.forEach(row => ws.addRow(row));

  // Freeze header row
  if (freezePane) {
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // Header styling (bold white on dark slate, centered)
  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data to PDF with formatting
 */
export interface PdfExportOptions {
  filename?: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
  includeHeader?: boolean;
  includeFooter?: boolean;
}

export const exportToPdf = <T extends Record<string, any>>(
  data: T[],
  options: PdfExportOptions = {}
) => {
  const {
    filename = 'export.pdf',
    title = 'Data Export',
    orientation = 'landscape',
    includeHeader = true,
    includeFooter = true,
  } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Add title
  if (includeHeader && title) {
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
  }

  // Prepare table data
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      if (value instanceof Date) return value.toLocaleDateString();
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value || '');
    })
  );

  // Add table
  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY: includeHeader ? 35 : 10,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 10, right: 10, bottom: 20, left: 10 },
  });

  // Add footer
  if (includeFooter) {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  }

  // Save file
  doc.save(filename);
};

/**
 * Export data as CSV (simple alternative to Excel)
 */
export interface CsvExportOptions {
  filename?: string;
  delimiter?: string;
  includeHeaders?: boolean;
}

export const exportToCsv = <T extends Record<string, any>>(
  data: T[],
  options: CsvExportOptions = {}
) => {
  const {
    filename = 'export.csv',
    delimiter = ',',
    includeHeaders = true,
  } = options;

  if (data.length === 0) {
    console.warn('Cannot export empty data');
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains delimiter
      const stringValue = String(value || '');
      const needsQuotes = stringValue.includes(delimiter) || stringValue.includes('"');
      return needsQuotes ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
    })
  );

  const csvContent = [
    includeHeaders ? headers.join(delimiter) : '',
    ...rows.map(r => r.join(delimiter)),
  ]
    .filter(Boolean)
    .join('\n');

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export data as JSON
 */
export interface JsonExportOptions {
  filename?: string;
  pretty?: boolean;
}

export const exportToJson = <T extends Record<string, any>>(
  data: T[],
  options: JsonExportOptions = {}
) => {
  const {
    filename = 'export.json',
    pretty = true,
  } = options;

  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Schedule export to be sent via email
 */
export interface ScheduledExport {
  id: string;
  name: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  format: 'xlsx' | 'pdf' | 'csv' | 'json';
  recipients: string[];
  query?: Record<string, any>;
  createdAt: Date;
  nextRunAt?: Date;
  lastRunAt?: Date;
  enabled: boolean;
}

/**
 * Store scheduled export configuration in localStorage
 */
export const saveScheduledExport = (
  exportConfig: Omit<ScheduledExport, 'id' | 'createdAt'>
): ScheduledExport => {
  const id = Date.now().toString();
  const scheduledExport: ScheduledExport = {
    ...exportConfig,
    id,
    createdAt: new Date(),
    enabled: true,
  };

  const stored = localStorage.getItem('scheduled_exports');
  const exports = stored ? JSON.parse(stored) : [];
  exports.push(scheduledExport);

  localStorage.setItem('scheduled_exports', JSON.stringify(exports));
  return scheduledExport;
};

/**
 * Get all scheduled exports from localStorage
 */
export const getScheduledExports = (): ScheduledExport[] => {
  const stored = localStorage.getItem('scheduled_exports');
  return stored ? JSON.parse(stored) : [];
};

/**
 * Delete scheduled export
 */
export const deleteScheduledExport = (id: string) => {
  const stored = localStorage.getItem('scheduled_exports');
  const exports = stored ? JSON.parse(stored) : [];
  const filtered = exports.filter((e: ScheduledExport) => e.id !== id);
  localStorage.setItem('scheduled_exports', JSON.stringify(filtered));
};

/**
 * Format export filename with timestamp
 */
export const getExportFilename = (baseName: string, format: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${baseName}_${timestamp}.${format}`;
};

/**
 * Generate data summary statistics
 */
export interface DataSummary {
  totalRecords: number;
  exportDate: Date;
  recordCount?: number;
  [key: string]: any;
}

export const generateDataSummary = <T extends Record<string, any>>(
  data: T[]
): DataSummary => {
  return {
    totalRecords: data.length,
    exportDate: new Date(),
    recordCount: data.length,
  };
};
