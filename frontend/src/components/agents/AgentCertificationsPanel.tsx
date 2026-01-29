import { Award, Plus, Trash2, Download, ExternalLink, Calendar } from 'lucide-react';
import type { Certification } from '../../types';
import { Button } from '../Button';
import { Badge } from '../Badge';

type AgentCertificationsPanelProps = {
  certifications: Certification[];
  onRemove: (id: string) => void;
};

export const AgentCertificationsPanel = ({ certifications, onRemove }: AgentCertificationsPanelProps) => {
  const getStatusVariant = (status: Certification['status']) => {
    switch (status) {
      case 'active': return 'success';
      case 'expired': return 'error';
      case 'pending': return 'warning';
      default: return 'neutral';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Award size={20} className="mr-2 text-primary" />
          Certifications
        </h3>
        <Button size="sm" onClick={() => {}}>
          <Plus size={16} className="mr-1" /> Add New
        </Button>
      </div>

      <div className="p-6">
        {certifications.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <Award size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No certifications recorded.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certifications.map((cert) => (
              <div key={cert.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded text-primary">
                      <Award size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{cert.name}</h4>
                      <p className="text-xs text-gray-500">ID: {cert.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(cert.status)}>{cert.status}</Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> Issued: {new Date(cert.issueDate).toLocaleDateString()}
                  </span>
                  {cert.expiryDate && (
                    <span className="flex items-center gap-1">
                      <Calendar size={14} /> Expires: {new Date(cert.expiryDate).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    <ExternalLink size={14} className="mr-1" /> View
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1">
                    <Download size={14} className="mr-1" /> PDF
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="!p-2 text-gray-400 hover:text-red-600 border-red-100"
                    onClick={() => onRemove(cert.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
