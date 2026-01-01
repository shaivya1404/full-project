import { Filter, X } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Select } from '../Select';

type AgentFiltersPanelProps = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: {
    status: string;
    role: string;
    department: string;
  };
  onFilterChange: (name: string, value: string) => void;
  onReset: () => void;
};

export const AgentFiltersPanel = ({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onReset,
}: AgentFiltersPanelProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-end">
        <div className="flex-1 w-full lg:w-auto">
          <Input
            placeholder="Search by name, email, or employee ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto lg:min-w-[500px]">
          <Select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            options={[
              { label: 'All Statuses', value: '' },
              { label: 'Online', value: 'online' },
              { label: 'Offline', value: 'offline' },
              { label: 'Away', value: 'away' },
              { label: 'Break', value: 'break' },
              { label: 'Busy', value: 'busy' },
            ]}
          />
          <Select
            value={filters.role}
            onChange={(e) => onFilterChange('role', e.target.value)}
            options={[
              { label: 'All Roles', value: '' },
              { label: 'Agent', value: 'agent' },
              { label: 'Senior Agent', value: 'senior_agent' },
              { label: 'Supervisor', value: 'supervisor' },
              { label: 'Admin', value: 'admin' },
            ]}
          />
          <Select
            value={filters.department}
            onChange={(e) => onFilterChange('department', e.target.value)}
            options={[
              { label: 'All Departments', value: '' },
              { label: 'Sales', value: 'Sales' },
              { label: 'Support', value: 'Support' },
              { label: 'Technical', value: 'Technical' },
              { label: 'Billing', value: 'Billing' },
            ]}
          />
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <Button variant="secondary" onClick={onReset} className="flex-1 lg:flex-none">
            <X size={16} className="mr-1" /> Reset
          </Button>
          <Button variant="primary" className="flex-1 lg:flex-none">
            <Filter size={16} className="mr-1" /> Apply
          </Button>
        </div>
      </div>
    </div>
  );
};
