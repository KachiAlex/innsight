import React, { useState } from 'react';
import { Download, FileText, File, Mail, X } from 'lucide-react';
import {
  exportToExcel,
  exportToPdf,
  exportToCsv,
  exportToJson,
  getExportFilename,
  saveScheduledExport,
  ScheduledExport,
} from '../utils/exportData';

interface ExportMenuProps<T extends Record<string, any>> {
  data: T[];
  label?: string;
  baseName?: string;
  onExported?: (filename: string) => void;
}

/**
 * Export Menu - Provides export options (Excel, PDF, CSV, JSON, Email)
 */
export const ExportMenu = React.forwardRef<HTMLDivElement, ExportMenuProps<any>>(
  ({ data, label = 'Export', baseName = 'export', onExported }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [emailRecipients, setEmailRecipients] = useState('');
    const [scheduleFrequency, setScheduleFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
    const [selectedFormat, setSelectedFormat] = useState<'xlsx' | 'pdf' | 'csv' | 'json'>('xlsx');

    const handleExportExcel = () => {
      const filename = getExportFilename(baseName, 'xlsx');
      exportToExcel(data, { filename });
      onExported?.(filename);
      setIsOpen(false);
    };

    const handleExportPdf = () => {
      const filename = getExportFilename(baseName, 'pdf');
      exportToPdf(data, { filename, title: baseName });
      onExported?.(filename);
      setIsOpen(false);
    };

    const handleExportCsv = () => {
      const filename = getExportFilename(baseName, 'csv');
      exportToCsv(data, { filename });
      onExported?.(filename);
      setIsOpen(false);
    };

    const handleExportJson = () => {
      const filename = getExportFilename(baseName, 'json');
      exportToJson(data, { filename });
      onExported?.(filename);
      setIsOpen(false);
    };

    const handleScheduleEmail = () => {
      if (!emailRecipients.trim()) {
        alert('Please enter at least one email address');
        return;
      }

      const recipients = emailRecipients.split(',').map(e => e.trim()).filter(Boolean);
      const scheduledExport: Omit<ScheduledExport, 'id' | 'createdAt'> = {
        name: `${baseName} - ${selectedFormat.toUpperCase()}`,
        frequency: scheduleFrequency,
        format: selectedFormat,
        recipients,
        enabled: true,
      };

      saveScheduledExport(scheduledExport);
      alert('Export scheduled successfully! It will be sent to your email inbox.');
      setShowEmailDialog(false);
      setEmailRecipients('');
      setIsOpen(false);
    };

    return (
      <div ref={ref} style={{ position: 'relative' }}>
        {/* Export Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
          title="Export data in various formats"
        >
          <Download size={16} />
          {label}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 10,
              minWidth: '200px',
            }}
          >
            {/* Export Options */}
            <div style={{ padding: '0.5rem' }}>
              <button
                onClick={handleExportExcel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1e293b',
                  textAlign: 'left',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <FileText size={16} style={{ color: '#10b981' }} />
                Export to Excel
              </button>

              <button
                onClick={handleExportPdf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1e293b',
                  textAlign: 'left',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <File size={16} style={{ color: '#ef4444' }} />
                Export to PDF
              </button>

              <button
                onClick={handleExportCsv}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1e293b',
                  textAlign: 'left',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <File size={16} style={{ color: '#f59e0b' }} />
                Export to CSV
              </button>

              <button
                onClick={handleExportJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1e293b',
                  textAlign: 'left',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <File size={16} style={{ color: '#8b5cf6' }} />
                Export to JSON
              </button>

              <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }} />

              <button
                onClick={() => setShowEmailDialog(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1e293b',
                  textAlign: 'left',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Mail size={16} style={{ color: '#3b82f6' }} />
                Schedule to Email
              </button>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  textAlign: 'left',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={16} />
                Close
              </button>
            </div>
          </div>
        )}

        {/* Email Dialog */}
        {showEmailDialog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => setShowEmailDialog(false)}
          >
            <div
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                maxWidth: '400px',
                width: '90%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Schedule Export</h3>
                <button
                  onClick={() => setShowEmailDialog(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Format Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: 500 }}>
                  Export Format
                </label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    color: '#1e293b',
                  }}
                >
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="json">JSON (.json)</option>
                </select>
              </div>

              {/* Email Recipients */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: 500 }}>
                  Email Recipients (comma-separated)
                </label>
                <textarea
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    minHeight: '60px',
                    color: '#1e293b',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Frequency */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: 500 }}>
                  Frequency
                </label>
                <select
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    color: '#1e293b',
                  }}
                >
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowEmailDialog(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#1e293b',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleEmail}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'white',
                    fontWeight: 500,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ExportMenu.displayName = 'ExportMenu';
