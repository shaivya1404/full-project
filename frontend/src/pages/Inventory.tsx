import { useState } from 'react';
import { DashboardLayout, Card, Button } from '../components';
import {
  useInventory,
  useInventoryStats,
  useLowStockProducts,
  useRestockProduct,
  useAdjustStock,
} from '../api/inventory';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Plus,
  Minus,
  Search,
  Filter,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | '';

export const InventoryPage = () => {
  const { user } = useAuthStore();
  const teamId = user?.id || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockStatus>('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const limit = 20;

  const { data: inventoryData, isLoading } = useInventory(teamId, page, limit, {
    stockStatus: stockFilter || undefined,
    search: search || undefined,
  });
  const { data: stats } = useInventoryStats(teamId);
  const { data: lowStockProducts } = useLowStockProducts(teamId);

  const restockMutation = useRestockProduct();
  const adjustMutation = useAdjustStock();

  const handleRestock = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      toast.error('Quantity must be positive');
      return;
    }
    try {
      await restockMutation.mutateAsync({ productId, quantity });
      toast.success('Product restocked');
      setSelectedProduct(null);
      setAdjustQuantity(0);
    } catch {
      toast.error('Failed to restock');
    }
  };

  const handleAdjust = async (productId: string, quantity: number) => {
    try {
      await adjustMutation.mutateAsync({
        productId,
        quantity,
        movementType: 'adjustment',
        reason: 'Manual adjustment',
      });
      toast.success('Stock adjusted');
      setSelectedProduct(null);
      setAdjustQuantity(0);
    } catch {
      toast.error('Failed to adjust stock');
    }
  };

  const getStockStatusBadge = (product: { stockQuantity: number; reorderLevel: number; minStockLevel: number }) => {
    if (product.stockQuantity === 0) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">Out of Stock</span>;
    }
    if (product.stockQuantity <= product.minStockLevel) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">Critical</span>;
    }
    if (product.stockQuantity <= product.reorderLevel) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">Low Stock</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">In Stock</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Inventory Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track stock levels, manage inventory, and prevent stockouts
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.totalProducts || 0}
                </p>
              </div>
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">In Stock</p>
                <p className="text-2xl font-bold text-green-600">{stats?.inStockProducts || 0}</p>
              </div>
              <Package className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{stats?.outOfStockProducts || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stock Value</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{(stats?.totalStockValue || 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts && lowStockProducts.length > 0 && (
          <Card className="p-4 border-l-4 border-yellow-500">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Low Stock Alert
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {lowStockProducts.length} product(s) need restocking
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <span
                      key={product.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-300"
                    >
                      {product.name}
                      <span className="text-xs">({product.stockQuantity})</span>
                    </span>
                  ))}
                  {lowStockProducts.length > 5 && (
                    <span className="text-sm text-gray-500">
                      +{lowStockProducts.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as StockStatus);
                  setPage(1);
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Inventory Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : inventoryData?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No products found
                    </td>
                  </tr>
                ) : (
                  inventoryData?.data?.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-500">{product.category || 'Uncategorized'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {product.sku || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-semibold ${
                            product.stockQuantity === 0 ? 'text-red-600' :
                            product.stockQuantity <= product.reorderLevel ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {product.stockQuantity}
                          </span>
                          <span className="text-sm text-gray-400">/ {product.reorderLevel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStockStatusBadge(product)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        ₹{product.price?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4">
                        {selectedProduct === product.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={adjustQuantity}
                              onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                            />
                            <button
                              onClick={() => handleRestock(product.id, adjustQuantity)}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Add Stock"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleAdjust(product.id, -adjustQuantity)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Remove Stock"
                            >
                              <Minus className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(null);
                                setAdjustQuantity(0);
                              }}
                              className="text-sm text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedProduct(product.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Adjust Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {inventoryData && inventoryData.total > limit && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, inventoryData.total)} of{' '}
                {inventoryData.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= inventoryData.total}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};
