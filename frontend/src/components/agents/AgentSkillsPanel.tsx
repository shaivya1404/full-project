import { Plus, Trash2, Award, Star } from 'lucide-react';
import { useState } from 'react';
import type { AgentSkill } from '../../types';
import { Button } from '../Button';
import { Badge } from '../Badge';

type AgentSkillsPanelProps = {
  agentId: string;
  skills: AgentSkill[];
  onAddSkill: (skill: Partial<AgentSkill>) => void;
  onRemoveSkill: (skillId: string) => void;
  onUpdateSkill: (skillId: string, data: Partial<AgentSkill>) => void;
};

export const AgentSkillsPanel = ({
  agentId,
  skills,
  onAddSkill,
  onRemoveSkill,
  onUpdateSkill,
}: AgentSkillsPanelProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newSkill, setNewSkill] = useState({
    skillName: '',
    proficiencyLevel: 'beginner' as AgentSkill['proficiencyLevel'],
    isPrimary: false,
  });

  const handleAdd = () => {
    onAddSkill({ ...newSkill, agentId });
    setIsAdding(false);
    setNewSkill({ skillName: '', proficiencyLevel: 'beginner', isPrimary: false });
  };

  const getProficiencyColor = (level: AgentSkill['proficiencyLevel']) => {
    switch (level) {
      case 'expert': return 'success';
      case 'advanced': return 'primary';
      case 'intermediate': return 'warning';
      case 'beginner': return 'neutral';
      default: return 'neutral';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Award size={20} className="mr-2 text-primary" />
          Skills & Proficiencies
        </h3>
        <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus size={16} className="mr-1" /> Add Skill
        </Button>
      </div>

      <div className="p-6">
        {isAdding && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skill Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  value={newSkill.skillName}
                  onChange={(e) => setNewSkill({ ...newSkill, skillName: e.target.value })}
                  placeholder="e.g., Technical Support"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proficiency</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  value={newSkill.proficiencyLevel}
                  onChange={(e) => setNewSkill({ ...newSkill, proficiencyLevel: e.target.value as any })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrimary"
                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                checked={newSkill.isPrimary}
                onChange={(e) => setNewSkill({ ...newSkill, isPrimary: e.target.checked })}
              />
              <label htmlFor="isPrimary" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Mark as primary skill
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAdd} disabled={!newSkill.skillName}>Add</Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {skills.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">No skills assigned yet.</p>
          ) : (
            skills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center">
                  <div className="mr-3">
                    {skill.isPrimary ? (
                      <Star size={20} className="text-yellow-400 fill-current" />
                    ) : (
                      <Star size={20} className="text-gray-300" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white flex items-center">
                      {skill.skillName}
                      {skill.isPrimary && <span className="ml-2 text-[10px] uppercase font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">Primary</span>}
                    </p>
                    <div className="flex items-center mt-1">
                      <Badge variant={getProficiencyColor(skill.proficiencyLevel)}>
                        {skill.proficiencyLevel.charAt(0).toUpperCase() + skill.proficiencyLevel.slice(1)}
                      </Badge>
                      {skill.validationDate && (
                        <span className="ml-3 text-xs text-gray-500">Validated: {new Date(skill.validationDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="text-xs border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1"
                    value={skill.proficiencyLevel}
                    onChange={(e) => onUpdateSkill(skill.id, { proficiencyLevel: e.target.value as any })}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                  <button
                    onClick={() => onRemoveSkill(skill.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
