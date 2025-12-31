import { DashboardLayout, Card } from '../components';
import { SearchBar } from '../components/knowledge/SearchBar';
import { ProductsTable } from '../components/knowledge/ProductsTable';
import { AddProductModal } from '../components/knowledge/AddProductModal';
import { EditProductModal } from '../components/knowledge/EditProductModal';
import { DeleteProductDialog } from '../components/knowledge/DeleteProductDialog';
import { BulkImportModal } from '../components/knowledge/BulkImportModal';
import { ProductFAQsSection } from '../components/knowledge/ProductFAQsSection';
import { useQuery } from '@tanstack/react-query';
import { getProducts, getProductFAQs, createProduct, updateProduct, deleteProduct, importProductsCSV, createProductFAQ, updateProductFAQ, deleteProductFAQ } from '../services/api';
import { useState } from 'react';
import type { Product, ProductFAQ } from '../types';
import toast from 'react-hot-toast';
import { Button } from '../components/Button';
import { Plus, Upload, BookOpen, Package } from 'lucide-react';

const TEAM_ID = 'team-1';
const DEFAULT_LIMIT = 10;

export const KnowledgeBasePage = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', TEAM_ID, page, DEFAULT_LIMIT, searchTerm],
    queryFn: () => getProducts(TEAM_ID, DEFAULT_LIMIT, (page - 1) * DEFAULT_LIMIT, searchTerm),
  });

  const { data: selectedProductFAQs, isLoading: faqsLoading, refetch: refetchFAQs } = useQuery({
    queryKey: ['product-faqs', selectedProduct?.id],
    queryFn: () => selectedProduct ? getProductFAQs(selectedProduct.id) : Promise.resolve([]),
    enabled: !!selectedProduct,
  });

  const products = productsData?.data || [];
  const total = productsData?.total || 0;
  const categories = Array.from(new Set(products.map(p => p.category)));

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setPage(1);
  };

  const handleCategoryFilter = (category: string) => {
    setCategoryFilter(category);
    setPage(1);
  };

  const getFilteredProducts = () => {
    if (categoryFilter === 'all') return products;
    return products.filter(p => p.category === categoryFilter);
  };

  const filteredProducts = getFilteredProducts();
  const filteredTotal = categoryFilter === 'all' ? total : filteredProducts.length;

  const handleAddProduct = async (data: {
    name: string;
    description?: string;
    category: string;
    price?: number;
  }) => {
    try {
      await createProduct(TEAM_ID, data);
      toast.success('Product added successfully');
      setIsAddModalOpen(false);
      refetchProducts();
    } catch (error) {
      toast.error('Failed to add product');
      throw error;
    }
  };

  const handleUpdateProduct = async (id: string, data: {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
  }) => {
    try {
      await updateProduct(id, data);
      toast.success('Product updated successfully');
      setIsEditModalOpen(false);
      refetchProducts();
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
      }
    } catch (error) {
      toast.error('Failed to update product');
      throw error;
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success('Product deleted successfully');
      setIsDeleteDialogOpen(false);
      refetchProducts();
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
      }
    } catch (error) {
      toast.error('Failed to delete product');
      throw error;
    }
  };

  const handleBulkImport = async (file: File) => {
    try {
      const result = await importProductsCSV(TEAM_ID, file);
      if (result.failed > 0) {
        toast.warning(`Imported ${result.imported} products, ${result.failed} failed`);
      } else {
        toast.success(`Successfully imported ${result.imported} products`);
      }
      setIsBulkImportOpen(false);
      refetchProducts();
    } catch (error) {
      toast.error('Failed to import products');
      throw error;
    }
  };

  const handleAddFAQ = async (productId: string, data: { question: string; answer: string; category?: string }) => {
    try {
      await createProductFAQ(productId, data);
      toast.success('FAQ added successfully');
      refetchFAQs();
    } catch (error) {
      toast.error('Failed to add FAQ');
      throw error;
    }
  };

  const handleUpdateFAQ = async (id: string, data: { question?: string; answer?: string; category?: string }) => {
    try {
      await updateProductFAQ(id, data);
      toast.success('FAQ updated successfully');
      refetchFAQs();
    } catch (error) {
      toast.error('Failed to update FAQ');
      throw error;
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    try {
      await deleteProductFAQ(id);
      toast.success('FAQ deleted successfully');
      refetchFAQs();
    } catch (error) {
      toast.error('Failed to delete FAQ');
      throw error;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <BookOpen size={32} className="text-primary" />
              Knowledge Base
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your products, services, and FAQs
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsBulkImportOpen(true)}>
              <Upload size={18} className="mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} className="mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="mb-6">
                <SearchBar
                  onSearch={handleSearch}
                  onCategoryFilter={handleCategoryFilter}
                  categories={categories}
                  searchPlaceholder="Search products by name or description..."
                />
              </div>

              <ProductsTable
                products={filteredProducts}
                loading={productsLoading}
                page={page}
                limit={DEFAULT_LIMIT}
                total={filteredTotal}
                onPageChange={setPage}
                onEdit={(product) => {
                  setSelectedProduct(product);
                  setIsEditModalOpen(true);
                }}
                onDelete={(product) => {
                  setSelectedProduct(product);
                  setIsDeleteDialogOpen(true);
                }}
              />
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Package size={20} className="text-primary" />
                  Product Details
                </h2>
                {selectedProduct ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Product Name
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedProduct.name}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Category
                      </label>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {selectedProduct.category}
                      </span>
                    </div>
                    {selectedProduct.price && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Price
                        </label>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          ${selectedProduct.price.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {selectedProduct.description && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Description
                        </label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedProduct.description}
                        </p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={() => {
                        setSelectedProduct(null);
                      }}
                    >
                      Close Details
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select a product from the table to view details and manage FAQs
                  </p>
                )}
              </div>

              {selectedProduct && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <ProductFAQsSection
                    productId={selectedProduct.id}
                    productName={selectedProduct.name}
                    faqs={selectedProductFAQs || []}
                    loading={faqsLoading}
                    onAddFAQ={handleAddFAQ}
                    onUpdateFAQ={handleUpdateFAQ}
                    onDeleteFAQ={handleDeleteFAQ}
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={handleAddProduct}
        categories={categories}
      />

      <EditProductModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        product={selectedProduct}
        onUpdateProduct={handleUpdateProduct}
        categories={categories}
      />

      <DeleteProductDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        product={selectedProduct}
        onDelete={handleDeleteProduct}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImport={handleBulkImport}
      />
    </DashboardLayout>
  );
};
