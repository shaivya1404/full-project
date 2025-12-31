import { Modal, Button } from '../index';
import { AlertTriangle } from 'lucide-react';
import type { Product } from '../../types';

type DeleteProductDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onDelete: (id: string) => void;
  loading?: boolean;
};

export const DeleteProductDialog = ({
  isOpen,
  onClose,
  product,
  onDelete,
  loading,
}: DeleteProductDialogProps) => {
  const handleDelete = () => {
    if (product) {
      onDelete(product.id);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Product"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={loading}>
            Delete Product
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle size={24} className="text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">
              This action cannot be undone
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Deleting this product will permanently remove it from the knowledge base.
            </p>
          </div>
        </div>

        {product && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete:
            </p>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Category: {product.category}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
