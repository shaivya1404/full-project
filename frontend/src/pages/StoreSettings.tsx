import { useState, useEffect } from 'react';
import { DashboardLayout, Card, Button, Input } from '../components';
import {
  useStoreInfo,
  useUpdateStoreInfo,
  useDeliveryZones,
  useCreateDeliveryZone,
  useDeleteDeliveryZone,
  useIsStoreOpen,
  type OperatingHours,
} from '../api/store';
import {
  Store,
  Clock,
  MapPin,
  Truck,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const StoreSettingsPage = () => {
  const { user } = useAuthStore();
  const teamId = user?.id || '';

  const { data: storeInfo, isLoading } = useStoreInfo(teamId);
  const { data: deliveryZones } = useDeliveryZones(teamId);
  const { data: isOpen } = useIsStoreOpen(teamId);

  const updateStoreMutation = useUpdateStoreInfo();
  const createZoneMutation = useCreateDeliveryZone();
  const deleteZoneMutation = useDeleteDeliveryZone();

  const [isEditing, setIsEditing] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    phone: '',
    timezone: 'Asia/Kolkata',
    deliveryEnabled: true,
    minOrderAmount: 0,
    avgPrepTime: 30,
  });

  const [operatingHours, setOperatingHours] = useState<OperatingHours>({});
  const [zoneForm, setZoneForm] = useState({
    zoneName: '',
    postalCodes: '',
    deliveryFee: 0,
    minOrderAmount: 0,
    estimatedTime: 30,
  });

  useEffect(() => {
    if (storeInfo) {
      setFormData({
        storeName: storeInfo.storeName,
        address: storeInfo.address,
        phone: storeInfo.phone || '',
        timezone: storeInfo.timezone,
        deliveryEnabled: storeInfo.deliveryEnabled,
        minOrderAmount: storeInfo.minOrderAmount,
        avgPrepTime: storeInfo.avgPrepTime,
      });
      try {
        setOperatingHours(JSON.parse(storeInfo.operatingHours));
      } catch {
        setOperatingHours({});
      }
    }
  }, [storeInfo]);

  const handleSaveStore = async () => {
    try {
      await updateStoreMutation.mutateAsync({
        teamId,
        ...formData,
        operatingHours,
      });
      toast.success('Store settings saved');
      setIsEditing(false);
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleCreateZone = async () => {
    try {
      await createZoneMutation.mutateAsync({
        teamId,
        zoneName: zoneForm.zoneName,
        postalCodes: zoneForm.postalCodes.split(',').map((c) => c.trim()),
        deliveryFee: zoneForm.deliveryFee,
        minOrderAmount: zoneForm.minOrderAmount,
        estimatedTime: zoneForm.estimatedTime,
      });
      toast.success('Delivery zone created');
      setShowZoneModal(false);
      setZoneForm({ zoneName: '', postalCodes: '', deliveryFee: 0, minOrderAmount: 0, estimatedTime: 30 });
    } catch {
      toast.error('Failed to create zone');
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Are you sure you want to delete this zone?')) return;
    try {
      await deleteZoneMutation.mutateAsync({ id: zoneId, teamId });
      toast.success('Zone deleted');
    } catch {
      toast.error('Failed to delete zone');
    }
  };

  const updateHours = (day: string, field: 'open' | 'close' | 'isClosed', value: string | boolean) => {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Store Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage store info, operating hours, and delivery zones
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isOpen !== undefined && (
              <span
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                  isOpen
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                }`}
              >
                {isOpen ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {isOpen ? 'Store Open' : 'Store Closed'}
              </span>
            )}
          </div>
        </div>

        {/* Store Info */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Store className="h-5 w-5" />
              Store Information
            </h2>
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSaveStore} isLoading={updateStoreMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Store Name"
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              disabled={!isEditing}
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={!isEditing}
            />
            <div className="md:col-span-2">
              <Input
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <Input
              label="Average Prep Time (minutes)"
              type="number"
              value={formData.avgPrepTime}
              onChange={(e) => setFormData({ ...formData, avgPrepTime: parseInt(e.target.value) || 0 })}
              disabled={!isEditing}
            />
            <Input
              label="Minimum Order Amount (₹)"
              type="number"
              value={formData.minOrderAmount}
              onChange={(e) => setFormData({ ...formData, minOrderAmount: parseFloat(e.target.value) || 0 })}
              disabled={!isEditing}
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="deliveryEnabled"
                checked={formData.deliveryEnabled}
                onChange={(e) => setFormData({ ...formData, deliveryEnabled: e.target.checked })}
                disabled={!isEditing}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="deliveryEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                Delivery Enabled
              </label>
            </div>
          </div>
        </Card>

        {/* Operating Hours */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5" />
            Operating Hours
          </h2>

          <div className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-4">
                <span className="w-24 capitalize text-gray-700 dark:text-gray-300">{day}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!operatingHours[day]?.isClosed}
                    onChange={(e) => updateHours(day, 'isClosed', !e.target.checked)}
                    disabled={!isEditing}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-500">Open</span>
                </label>
                {!operatingHours[day]?.isClosed && (
                  <>
                    <input
                      type="time"
                      value={operatingHours[day]?.open || '09:00'}
                      onChange={(e) => updateHours(day, 'open', e.target.value)}
                      disabled={!isEditing}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={operatingHours[day]?.close || '22:00'}
                      onChange={(e) => updateHours(day, 'close', e.target.value)}
                      disabled={!isEditing}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Delivery Zones */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Delivery Zones
            </h2>
            <Button onClick={() => setShowZoneModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Zone
            </Button>
          </div>

          {deliveryZones && deliveryZones.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveryZones.map((zone) => (
                <div
                  key={zone.id}
                  className={`p-4 border rounded-lg ${
                    zone.isActive
                      ? 'border-gray-200 dark:border-gray-700'
                      : 'border-gray-200 dark:border-gray-700 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">{zone.zoneName}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {JSON.parse(zone.postalCodes).length} postal codes
                    </div>
                    <div>Delivery Fee: ₹{zone.deliveryFee}</div>
                    <div>Est. Time: {zone.estimatedTime} mins</div>
                    {zone.minOrderAmount > 0 && <div>Min Order: ₹{zone.minOrderAmount}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No delivery zones configured</p>
          )}
        </Card>

        {/* Add Zone Modal */}
        {showZoneModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add Delivery Zone
              </h3>
              <div className="space-y-4">
                <Input
                  label="Zone Name"
                  value={zoneForm.zoneName}
                  onChange={(e) => setZoneForm({ ...zoneForm, zoneName: e.target.value })}
                  placeholder="e.g., Downtown"
                />
                <Input
                  label="Postal Codes (comma-separated)"
                  value={zoneForm.postalCodes}
                  onChange={(e) => setZoneForm({ ...zoneForm, postalCodes: e.target.value })}
                  placeholder="110001, 110002, 110003"
                />
                <Input
                  label="Delivery Fee (₹)"
                  type="number"
                  value={zoneForm.deliveryFee}
                  onChange={(e) => setZoneForm({ ...zoneForm, deliveryFee: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  label="Estimated Delivery Time (minutes)"
                  type="number"
                  value={zoneForm.estimatedTime}
                  onChange={(e) => setZoneForm({ ...zoneForm, estimatedTime: parseInt(e.target.value) || 0 })}
                />
                <Input
                  label="Minimum Order (₹)"
                  type="number"
                  value={zoneForm.minOrderAmount}
                  onChange={(e) => setZoneForm({ ...zoneForm, minOrderAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowZoneModal(false)} fullWidth>
                  Cancel
                </Button>
                <Button onClick={handleCreateZone} isLoading={createZoneMutation.isPending} fullWidth>
                  Create Zone
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
