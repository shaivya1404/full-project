import { Modal, Button, Select } from '../index';
import { useState, useEffect } from 'react';
import { Upload, FileText, Check, X, AlertCircle } from 'lucide-react';

type ContactListUploadProps = {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => void;
  loading?: boolean;
};

type CSVPreview = {
  headers: string[];
  rows: string[][];
};

export const ContactListUpload = ({
  isOpen,
  onClose,
  onImport,
  loading,
}: ContactListUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: '',
    phone: '',
    email: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreview(null);
      setMapping({ name: '', phone: '', email: '' });
      setError('');
    }
  }, [isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setError('');
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        setError('CSV file must have at least a header row and one data row');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1, 6).map(line => parseCSVLine(line));

      setPreview({ headers, rows });

      setMapping(prev => ({
        ...prev,
        name: headers.find(h => h.toLowerCase().includes('name')) || '',
        phone: headers.find(h => h.toLowerCase().includes('phone') || h.toLowerCase().includes('mobile') || h.toLowerCase().includes('tel')) || '',
        email: headers.find(h => h.toLowerCase().includes('email')) || '',
      }));
    };
    reader.readAsText(selectedFile);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!mapping.phone) {
      setError('Please map the required field: Phone');
      return;
    }

    setError('');
    onImport(file);
  };

  const availableHeaders = preview?.headers || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Contact List"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            isLoading={loading}
            disabled={!file || !mapping.phone}
          >
            <Upload size={18} className="mr-2" />
            Import Contacts
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {!file ? (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="contact-csv-upload"
            />
            <label htmlFor="contact-csv-upload" className="cursor-pointer">
              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Click to upload or drag and drop contact CSV
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                CSV files only (max 10MB)
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {preview && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Map CSV Columns to Contact Fields
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                      label="Phone (Required) *"
                      value={mapping.phone}
                      onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                      options={[
                        { value: '', label: 'Select column...' },
                        ...availableHeaders.map(h => ({ value: h, label: h })),
                      ]}
                    />
                    <Select
                      label="Name"
                      value={mapping.name}
                      onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                      options={[
                        { value: '', label: 'Select column...' },
                        ...availableHeaders.map(h => ({ value: h, label: h })),
                      ]}
                    />
                    <Select
                      label="Email"
                      value={mapping.email}
                      onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                      options={[
                        { value: '', label: 'Select column...' },
                        ...availableHeaders.map(h => ({ value: h, label: h })),
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Preview (first 5 rows)
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          {preview.headers.map((header, index) => (
                            <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {preview.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
            <AlertCircle size={18} className="mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400">
          <Check size={18} className="mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">CSV Format Requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>First row should contain column headers</li>
              <li>Must include a phone number column</li>
              <li>International format (e.g., +1234567890) is recommended</li>
              <li>Max file size: 10MB</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};
