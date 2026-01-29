import { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { Select } from '../Select';
import type { Agent } from '../../types';

type EditAgentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Agent>) => Promise<void>;
  agent: Agent | null;
  loading?: boolean;
};

export const EditAgentModal = ({ isOpen, onClose, onUpdate, agent, loading }: EditAgentModalProps) => {
  const [formData, setFormData] = useState<Partial<Agent>>({});

  useEffect(() => {
    if (agent) {
      setFormData({
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
        phone: agent.phone,
        employeeId: agent.employeeId,
        department: agent.department,
        role: agent.role,
        agentType: agent.agentType,
        status: agent.status,
        hireDate: agent.hireDate,
      });
    }
  }, [agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (agent) {
      await onUpdate(agent.id, formData);
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (!agent) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Agent Profile">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            name="firstName"
            value={formData.firstName || ''}
            onChange={handleChange}
            required
          />
          <Input
            label="Last Name"
            name="lastName"
            value={formData.lastName || ''}
            onChange={handleChange}
            required
          />
        </div>

        <Input
          label="Email Address"
          name="email"
          type="email"
          value={formData.email || ''}
          onChange={handleChange}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
          />
          <Input
            label="Employee ID"
            name="employeeId"
            value={formData.employeeId || ''}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Department"
            name="department"
            value={formData.department || ''}
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
            value={formData.role || 'agent'}
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
            value={formData.agentType || 'full_time'}
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
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
