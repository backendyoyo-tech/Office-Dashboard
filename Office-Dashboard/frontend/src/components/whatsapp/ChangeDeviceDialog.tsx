import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi, whatsappApi } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Smartphone } from 'lucide-react';

interface ChangeDeviceDialogProps {
  version: number;
  currentDeviceId: string;
  phoneNumberId: string;
  onClose: () => void;
}

export const ChangeDeviceDialog: React.FC<ChangeDeviceDialogProps> = ({
  currentDeviceId,
  phoneNumberId,
  version,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const { data: devicesData, isLoading: loadingDevices } = useQuery({
    queryKey: ['devices', { enabled: true }],
    queryFn: () => devicesApi.list({ enabled: true, pageSize: 100 }),
  });

  const changeDeviceMutation = useMutation({
    mutationFn: () =>
      whatsappApi.changeDevice(phoneNumberId, { newDeviceId: selectedDeviceId, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-number', phoneNumberId] });
      onClose();
    },
  });

  const devices = devicesData?.data || [];
  const availableDevices = devices.filter(
    (d) => d.enabled && d.id !== currentDeviceId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl animate-fade-in">
        <h3 className="text-lg font-medium text-gray-900">Change Device</h3>
        <p className="mt-2 text-sm text-gray-500">
          Select a new device to host this WhatsApp session.
        </p>

        {loadingDevices ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : availableDevices.length === 0 ? (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              No other enabled devices available.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {availableDevices.map((device) => (
              <label
                key={device.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  selectedDeviceId === device.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="device"
                  value={device.id}
                  checked={selectedDeviceId === device.id}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <Smartphone className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{device.friendlyName}</p>
                  <p className="text-xs text-gray-500">
                    {device.deviceCode} • {device.hostname || 'No hostname'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    device.status === 'ONLINE'
                      ? 'bg-green-100 text-green-800'
                      : device.status === 'OFFLINE'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {device.status}
                </span>
              </label>
            ))}
          </div>
        )}

        {changeDeviceMutation.isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3">
            <p className="text-sm text-red-700">
              Failed to change device. Please try again.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => changeDeviceMutation.mutate()}
            disabled={!selectedDeviceId || changeDeviceMutation.isPending}
            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {changeDeviceMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
            Change Device
          </button>
        </div>
      </div>
    </div>
  );
};
