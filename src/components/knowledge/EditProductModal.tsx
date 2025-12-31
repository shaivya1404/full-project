import { Modal, Button, Input, Select } from '../index';
import { useState, useEffect } from 'react';
import type { Product } from '../../types';

type EditProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdateProduct: (id: string, data: {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    details?: Record<string, unknown>;
  }) => void;
  loading?: boolean;
  categories: string[];
};

const categoryOptions = [
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'services', label: 'Services' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'digital', label: 'Digital Product' },
  { value: 'physical', label: 'Physical Product' },
  { value: 'other', label: 'Other' },
];

export const EditProductModal = ({
  isOpen,
  onClose,
  product,
  onUpdateProduct,
  loading,
  categories,
}: EditProductModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('software');
  const [price, setPrice] = useState<string>('');
  const [customCategory, setCustomCategory] = useState('');
  const [nameError, setNameError] = useState('');
  const [categoryError, setCategoryError] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      const categoryExists = [...categoryOptions, ...categories.map(c => ({ value: c, label: c }))]
        .find(opt => opt.value === product.category);
      if (categoryExists) {
        setCategory(product.category);
        setCustomCategory('');
      } else {
        setCategory('custom');
        setCustomCategory(product.category);
      }
      setPrice(product.price ? product.price.toString() : '');
      setNameError('');
      setCategoryError('');
    }
  }, [product, categories]);

  const handleSubmit = () => {
    if (!product) return;

    if (!name.trim()) {
      setNameError('Product name is required');
      return;
    }
    if (!category || category === '') {
      setCategoryError('Category is required');
      return;
    }

    const finalCategory = category === 'custom' ? customCategory : category;
    if (!finalCategory.trim()) {
      setCategoryError('Category is required');
      return;
    }

    const priceNum = price ? parseFloat(price) : undefined;
    if (price && isNaN(priceNum as number)) {
      setNameError('Please enter a valid price');
      return;
    }

    setNameError('');
    setCategoryError('');

    onUpdateProduct(product.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      category: finalCategory.trim(),
      price: priceNum,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Product"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
            Update Product
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Product Name"
          placeholder="Enter product name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError('');
          }}
          error={nameError}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter product description"
            rows={3}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <Select
          label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (categoryError) setCategoryError('');
          }}
          error={categoryError}
          options={[
            ...categoryOptions,
            ...(categories.filter(c => !categoryOptions.find(opt => opt.value === c)).map(c => ({ value: c, label: c }))),
            { value: 'custom', label: 'Custom Category...' },
          ]}
        />

        {category === 'custom' && (
          <Input
            label="Custom Category"
            placeholder="Enter custom category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
          />
        )}

        <Input
          label="Price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter price (optional)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
    </Modal>
  );
};
