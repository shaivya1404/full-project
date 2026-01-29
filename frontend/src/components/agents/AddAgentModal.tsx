import { useState } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { Select } from '../Select';
import type { Agent } from '../../types';

type AddAgentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: Partial<Agent>) => Promise<void>;
  loading?: boolean;
};

export const AddAgentModal = ({ isOpen, onClose, onAdd, loading }: AddAgentModalProps) => {
  const [formData, setFormData] = useState<Partial<Agent>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: '',
    department: '',
    role: 'agent',
    agentType: 'full_time',
    status: 'offline',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd(formData);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Agent">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
            placeholder="John"
          />
          <Input
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
            placeholder="Doe"
          />
        </div>

        <Input
          label="Email Address"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
          placeholder="john.doe@example.com"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+1 (555) 000-0000"
          />
          <Input
            label="Employee ID"
            name="employeeId"
            value={formData.employeeId}
            onChange={handleChange}
            placeholder="EMP-123"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            options={[
              { label: 'Sales', value: 'Sales' },
              { label: 'Support', value: 'Support' },
              { label: 'Technical', value: 'Technical' },
              { label: 'Billing', value: 'Billing' },
            ]}
          />
          <Select
            label="Role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            options={[
              { label: 'Agent', value: 'agent' },
              { label: 'Senior Agent', value: 'senior_agent' },
              { label: 'Supervisor', value: 'supervisor' },
              { label: 'Admin', value: 'admin' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Agent Type"
            name="agentType"
            value={formData.agentType}
            onChange={handleChange}
            options={[
              { label: 'Full-time', value: 'full_time' },
              { label: 'Part-time', value: 'part_time' },
              { label: 'Contract', value: 'contract' },
            ]}
          />
          <Input
            label="Hire Date"
            name="hireDate"
            type="date"
            value={formData.hireDate || ''}
            onChange={handleChange}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={loading}>
            Create Agent
          </Button>
        </div>
      </form>
    </Modal>
  );
};
