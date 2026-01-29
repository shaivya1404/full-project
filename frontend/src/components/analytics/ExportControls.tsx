import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportAnalyticsData } from '../../services/api';
import type { DateRange } from '../../types';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

interface ExportControlsProps {
  dateRange: DateRange;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export const ExportControls: React.FC<ExportControlsProps> = ({ dateRange, data }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      toast.loading('Preparing CSV export...', { id: 'export-csv' });

      const blob = await exportAnalyticsData(dateRange);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('CSV exported successfully!', { id: 'export-csv' });
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export CSV', { id: 'export-csv' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      toast.loading('Preparing PDF export...', { id: 'export-pdf' });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = 20;

      // Title
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('Analytics Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Date Range
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Date Range: ${dateRange.startDate} to ${dateRange.endDate}`,
        pageWidth / 2,
        yPosition,
        { align: 'center' }
      );
      yPosition += 15;
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, {
        align: 'center',
      });
      yPosition += 20;

      // Key Metrics
      if (data) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Key Metrics', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        const metrics = [
          { label: 'Total Calls', value: data.totalCalls?.toLocaleString() || '0' },
          { label: 'Average Duration', value: `${Math.floor((data.avgDuration || 0) / 60)}m ${(data.avgDuration || 0) % 60}s` },
          { label: 'Sentiment Score', value: `${data.sentimentScore || 0}/100` },
          { label: 'Active Calls', value: data.activeCalls?.toLocaleString() || '0' },
        ];

        metrics.forEach((metric) => {
          doc.text(`${metric.label}:`, margin, yPosition);
          doc.text(metric.value, margin + 50, yPosition);
          yPosition += 7;
        });

        yPosition += 10;

        // Status Breakdown
        if (data.statusBreakdown && data.statusBreakdown.length > 0) {
          doc.setFontSize(14);
          doc.setTextColor(0, 0, 0);
          doc.text('Call Status Distribution', margin, yPosition);
          yPosition += 10;

          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.statusBreakdown.forEach((status: any) => {
            doc.text(
              `${status.status.replace('-', ' ')}: ${status.count} (${status.percentage}%)`,
              margin,
              yPosition
            );
            yPosition += 7;
          });
          yPosition += 10;
        }

        // Sentiment Breakdown
        if (data.sentimentBreakdown && data.sentimentBreakdown.length > 0) {
          doc.setFontSize(14);
          doc.setTextColor(0, 0, 0);
          doc.text('Sentiment Distribution', margin, yPosition);
          yPosition += 10;

          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.sentimentBreakdown.forEach((sentiment: any) => {
            doc.text(
              `${sentiment.sentiment}: ${sentiment.count} (${sentiment.percentage}%)`,
              margin,
              yPosition
            );
            yPosition += 7;
          });
          yPosition += 10;
        }

        // Agent Performance
        if (data.agentPerformance && data.agentPerformance.length > 0) {
          doc.setFontSize(14);
          doc.setTextColor(0, 0, 0);
          doc.text('Agent Performance', margin, yPosition);
          yPosition += 10;

          // Table header
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          const tableHeaders = ['Agent', 'Calls', 'Avg Duration', 'Completion Rate', 'Sentiment'];
          const colWidths = [40, 20, 30, 35, 30];
          let xPos = margin;

          tableHeaders.forEach((header) => {
            doc.text(header, xPos, yPosition);
            xPos += colWidths[tableHeaders.indexOf(header)] || 20;
          });
          yPosition += 7;

          // Table data
          doc.setFont('helvetica', 'normal');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.agentPerformance?.slice(0, 10).forEach((agent: any) => {
            xPos = margin;
            const duration = Math.floor(agent.avgDuration / 60) + 'm ' + (agent.avgDuration % 60) + 's';

            doc.text(agent.agentName.substring(0, 20), xPos, yPosition);
            xPos += colWidths[0];
            doc.text(agent.callsHandled.toString(), xPos, yPosition);
            xPos += colWidths[1];
            doc.text(duration, xPos, yPosition);
            xPos += colWidths[2];
            doc.text(agent.completionRate.toFixed(1) + '%', xPos, yPosition);
            xPos += colWidths[3];
            doc.text(agent.avgSentimentScore.toFixed(1), xPos, yPosition);

            yPosition += 7;
          });
        }
      }

      doc.save(`analytics-report-${Date.now()}.pdf`);
      toast.success('PDF exported successfully!', { id: 'export-pdf' });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error('Failed to export PDF', { id: 'export-pdf' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export as CSV"
      >
        <FileSpreadsheet size={16} />
        CSV
      </button>

      <button
        onClick={handleExportPDF}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export as PDF"
      >
        <FileText size={16} />
        PDF
      </button>

      <button
        onClick={handleExportCSV}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Quick download"
      >
        <Download size={16} />
        Export
      </button>
    </div>
  );
};
