import { useState } from 'react';
import { Save, RefreshCw, Wand2, Copy, Sparkles } from 'lucide-react';
import { Button } from '../index';
import { Card } from '../Card';

type PromptEditorProps = {
  initialPrompt?: string;
  onSave: (prompt: string) => void;
  loading?: boolean;
};

const templates = [
  {
    name: 'Inbound Pizza Order',
    prompt: 'You are a friendly pizza ordering assistant for "Pizza Palace". Your goal is to take orders efficiently. Ask for: 1. Pizza type and size 2. Extra toppings 3. Delivery or pickup 4. Delivery address (if needed). Be polite and confirm the order at the end.',
  },
  {
    name: 'Outbound Insurance Lead',
    prompt: 'You are a sales representative for "SafeGuard Insurance". You are calling {customer_name} because they showed interest in life insurance. Your goal is to qualify them by asking about their current coverage and schedule a call with a licensed agent.',
  },
  {
    name: 'Customer Support Bot',
    prompt: 'You are a customer support agent for a tech company. You are helpful, patient, and professional. Use the knowledge base to answer technical questions. If you cannot find an answer, offer to transfer them to a human agent.',
  },
];

const variables = ['{customer_name}', '{product_name}', '{order_id}', '{agent_name}', '{appointment_time}'];

export const PromptEditor = ({
  initialPrompt,
  onSave,
  loading,
}: PromptEditorProps) => {
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [isDirty, setIsDirty] = useState(false);

  const handlePromptChange = (val: string) => {
    setPrompt(val);
    setIsDirty(true);
  };

  const insertVariable = (variable: string) => {
    setPrompt((prev) => prev + variable);
    setIsDirty(true);
  };

  const useTemplate = (templatePrompt: string) => {
    if (prompt && !confirm('Are you sure you want to replace your current prompt with this template?')) {
      return;
    }
    setPrompt(templatePrompt);
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Prompt Editor</h3>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handlePromptChange('')}
                  disabled={!prompt}
                >
                  Clear
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => {
                    onSave(prompt);
                    setIsDirty(false);
                  }}
                  disabled={!isDirty || loading}
                  isLoading={loading}
                >
                  <Save size={16} className="mr-2" />
                  Save Prompt
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                className="w-full h-96 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed resize-none"
                placeholder="Enter your system instructions for the AI..."
              />

              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-2 flex items-center">
                  Insert Variables:
                </span>
                {variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                <Sparkles size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">AI Prompt Assistant</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Need help writing a perfect prompt? Our AI assistant can help you refine your instructions for better results.
                </p>
                <Button variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Wand2 size={16} className="mr-2" />
                  Improve my prompt
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider px-1">Templates</h3>
          {templates.map((template, idx) => (
            <Card 
              key={idx} 
              className="p-4 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-colors"
              onClick={() => useTemplate(template.prompt)}
            >
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-between">
                {template.name}
                <Copy size={14} className="text-gray-400" />
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
                {template.prompt}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
