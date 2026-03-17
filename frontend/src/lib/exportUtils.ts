/**
 * Export utilities for reports and data
 */

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  filename?: string;
  headers?: string[];
  data: any[];
}

// Export data to CSV
export const exportToCSV = (data: any[], filename: string = 'export.csv', headers?: string[]) => {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    csvHeaders.join(','),
    ...data.map((row) =>
      csvHeaders
        .map((header) => {
          const cell = row[header];
          const stringCell = String(cell || '');
          return stringCell.includes(',') ? `"${stringCell}"` : stringCell;
        })
        .join(',')
    ),
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
};

// Export data to JSON
export const exportToJSON = (data: any[], filename: string = 'export.json') => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
};

// Export report with data
export const exportReport = (options: ExportOptions) => {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = options.filename || `report-${timestamp}`;

  switch (options.format) {
    case 'csv':
      exportToCSV(options.data, `${filename}.csv`, options.headers);
      break;
    case 'json':
      exportToJSON(options.data, `${filename}.json`);
      break;
    case 'pdf':
      // PDF export would require additional library (e.g., jsPDF)
      console.warn('PDF export not yet implemented, falling back to JSON');
      exportToJSON(options.data, `${filename}.json`);
      break;
    default:
      console.error('Unknown export format');
  }
};
