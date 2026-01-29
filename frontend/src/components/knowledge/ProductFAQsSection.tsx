import { useState } from 'react';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { Button, Input, Modal } from '../index';
import type { ProductFAQ } from '../../types';

type ProductFAQsSectionProps = {
  productId: string;
  productName: string;
  faqs: ProductFAQ[];
  loading?: boolean;
  onAddFAQ: (productId: string, data: { question: string; answer: string; category?: string }) => void;
  onUpdateFAQ: (id: string, data: { question?: string; answer?: string; category?: string }) => void;
  onDeleteFAQ: (id: string) => void;
};

const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'features', label: 'Features' },
  { value: 'technical', label: 'Technical' },
  { value: 'support', label: 'Support' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
];

export const ProductFAQsSection = ({
  productId,
  productName,
  faqs,
  loading,
  onAddFAQ,
  onUpdateFAQ,
  onDeleteFAQ,
}: ProductFAQsSectionProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedFAQ, setSelectedFAQ] = useState<ProductFAQ | null>(null);
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('general');
  const [errors, setErrors] = useState<{ question?: string; answer?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(faqId)) {
        newSet.delete(faqId);
      } else {
        newSet.add(faqId);
      }
      return newSet;
    });
  };

  const validateForm = () => {
    const newErrors: { question?: string; answer?: string } = {};
    if (!question.trim()) {
      newErrors.question = 'Question is required';
    }
    if (!answer.trim()) {
      newErrors.answer = 'Answer is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddFAQ = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onAddFAQ(productId, {
        question: question.trim(),
        answer: answer.trim(),
        category: category || undefined,
      });
      setIsAddModalOpen(false);
      setQuestion('');
      setAnswer('');
      setCategory('general');
      setErrors({});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateFAQ = async () => {
    if (!selectedFAQ || !validateForm()) return;

    setIsSubmitting(true);
    try {
      await onUpdateFAQ(selectedFAQ.id, {
        question: question.trim(),
        answer: answer.trim(),
        category: category || undefined,
      });
      setIsEditModalOpen(false);
      setSelectedFAQ(null);
      setQuestion('');
      setAnswer('');
      setCategory('general');
      setErrors({});
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (faq: ProductFAQ) => {
    setSelectedFAQ(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setCategory(faq.category || 'general');
    setErrors({});
    setIsEditModalOpen(true);
  };

  const handleDeleteFAQ = async (faqId: string) => {
    if (window.confirm('Are you sure you want to delete this FAQ?')) {
      await onDeleteFAQ(faqId);
    }
  };

  const FAQModal = ({
    isOpen,
    onClose,
    title,
    onSubmit,
    submitLabel,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    onSubmit: () => void;
    submitLabel: string;
  }) => (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Question *"
          placeholder="Enter the question"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (errors.question) setErrors({ ...errors, question: undefined });
          }}
          error={errors.question}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Answer *
          </label>
          <textarea
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (errors.answer) setErrors({ ...errors, answer: undefined });
            }}
            placeholder="Enter the answer"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          {errors.answer && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.answer}</p>
          )}
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <HelpCircle size={20} className="text-primary" />
          Frequently Asked Questions
        </h3>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} className="mr-2" />
          Add FAQ
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : faqs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <HelpCircle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            No FAQs yet for {productName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Add FAQs to help users understand this product better
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(faq.id)}
                className="w-full px-4 py-3 flex items-start justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {faq.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {faq.category}
                      </span>
                    )}
                    <h4 className="font-medium text-gray-900 dark:text-white">{faq.question}</h4>
                  </div>
                </div>
                {expandedFAQs.has(faq.id) ? (
                  <ChevronUp size={18} className="text-gray-400 flex-shrink-0 ml-2" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400 flex-shrink-0 ml-2" />
                )}
              </button>

              {expandedFAQs.has(faq.id) && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{faq.answer}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(faq)}>
                      <Edit size={14} className="mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteFAQ(faq.id)}>
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FAQModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setQuestion('');
          setAnswer('');
          setCategory('general');
          setErrors({});
        }}
        title="Add New FAQ"
        onSubmit={handleAddFAQ}
        submitLabel="Add FAQ"
      />

      <FAQModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedFAQ(null);
          setQuestion('');
          setAnswer('');
          setCategory('general');
          setErrors({});
        }}
        title="Edit FAQ"
        onSubmit={handleUpdateFAQ}
        submitLabel="Update FAQ"
      />
    </div>
  );
};
