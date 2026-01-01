import { Modal } from '../Modal';
import { Button } from '../Button';
import { Select } from '../Select';
import { useState, useEffect } from 'react';
import { Upload, FileText, X, AlertCircle, Check } from 'lucide-react';

type BulkImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => void;
  loading?: boolean;
};

type CSVPreview = {
  headers: string[];
  rows: string[][];
};

export const BulkImportModal = ({
  isOpen,
  onClose,
  onImport,
  loading,
}: BulkImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: '',
    description: '',
    category: '',
    price: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreview(null);
      setMapping({ name: '', description: '', category: '', price: '' });
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
        description: headers.find(h => h.toLowerCase().includes('desc')) || '',
        category: headers.find(h => h.toLowerCase().includes('category')) || '',
        price: headers.find(h => h.toLowerCase().includes('price')) || '',
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

    if (!mapping.name) {
      setError('Please map the required field: Name');
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
      title="Bulk Import Products"
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
            disabled={!file || !mapping.name}
          >
            <Upload size={18} className="mr-2" />
            Import {preview?.rows.length || 0} Products
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {!file ? (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                CSV files only (max 5MB)
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-gray-400" />
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
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            {preview && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Map CSV Columns to Product Fields
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Product Name Column"
                      value={mapping.name}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMapping({ ...mapping, name: e.target.value })}
                      options={availableHeaders.map(h => ({ value: h, label: h }))}
                      required
                    />
                    <Select
                      label="Category Column"
                      value={mapping.category}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMapping({ ...mapping, category: e.target.value })}
                      options={availableHeaders.map(h => ({ value: h, label: h }))}
                    />
                    <Select
                      label="Description Column"
                      value={mapping.description}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMapping({ ...mapping, description: e.target.value })}
                      options={availableHeaders.map(h => ({ value: h, label: h }))}
                    />
                    <Select
                      label="Price Column"
                      value={mapping.price}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMapping({ ...mapping, price: e.target.value })}
                      options={availableHeaders.map(h => ({ value: h, label: h }))}
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
                            <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {preview.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle size={18} className="text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Check size={18} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <p className="font-medium mb-1">CSV Format Requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>First row should contain column headers</li>
              <li>Map at least the "Name" field</li>
              <li>Price should be a number (without currency symbol)</li>
              <li>Max file size: 5MB</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};
