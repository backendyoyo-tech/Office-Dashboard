import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { phoneNumbersApi, devicesApi, whatsappApi } from '@/lib/api';
import { FormField, SelectField, TextAreaField } from '@/components/shared/FormField';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ArrowLeft } from 'lucide-react';

const phoneSchema = z.object({
  countryCode: z.string().min(1, 'Country code is required'),
  nationalNumber: z.string().min(4, 'Phone number is too short'),
  label: z.string().optional(),
  simProvider: z.string().optional(),
  notes: z.string().optional(),
  enableWhatsapp: z.boolean().optional(),
  deviceId: z.string().optional(),
});

type PhoneFormData = z.infer<typeof phoneSchema>;

const AddEditNumberPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  const { data: devicesData, isLoading: loadingDevices } = useQuery({
    queryKey: ['devices', { enabled: true }],
    queryFn: () => devicesApi.list({ enabled: true, pageSize: 100 }),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      countryCode: '+1',
      enableWhatsapp: false,
    },
  });

  const enableWhatsapp = watch('enableWhatsapp');

  const createMutation = useMutation({
    mutationFn: async (data: PhoneFormData) => {
      const e164Number = `${data.countryCode}${data.nationalNumber}`;
      const phone = await phoneNumbersApi.create({
        phoneNumber: e164Number,
        countryCode: data.countryCode,
        nationalNumber: data.nationalNumber,
        label: data.label || undefined,
        simProvider: data.simProvider || undefined,
        notes: data.notes || undefined,
      });

      if (data.enableWhatsapp && data.deviceId) {
        await whatsappApi.setup({
          phoneNumberId: phone.id,
          deviceId: data.deviceId,
        });
      }

      return phone;
    },
    onSuccess: (phone) => {
      navigate(`/phone-numbers/${phone.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create phone number');
    },
  });

  const devices = devicesData?.data || [];

  const countryCodes = [
    { value: '+1', label: '+1 (US/CA)' },
    { value: '+44', label: '+44 (UK)' },
    { value: '+91', label: '+91 (IN)' },
    { value: '+61', label: '+61 (AU)' },
    { value: '+49', label: '+49 (DE)' },
    { value: '+33', label: '+33 (FR)' },
    { value: '+81', label: '+81 (JP)' },
    { value: '+86', label: '+86 (CN)' },
    { value: '+55', label: '+55 (BR)' },
    { value: '+52', label: '+52 (MX)' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/phone-numbers')}
          className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Phone Number</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add a new phone number to your dashboard
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="space-y-6"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex gap-2">
              <select
                {...register('countryCode')}
                className="w-36 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {countryCodes.map((cc) => (
                  <option key={cc.value} value={cc.value}>
                    {cc.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="2025551234"
                {...register('nationalNumber')}
                className={`flex-1 rounded-lg border ${
                  errors.nationalNumber ? 'border-red-300' : 'border-gray-300'
                } bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
              />
            </div>
            {errors.nationalNumber && (
              <p className="mt-1 text-xs text-red-600">{errors.nationalNumber.message}</p>
            )}
          </div>

          <FormField
            label="Label"
            name="label"
            placeholder="e.g., Main Business Line"
            register={register}
            error={errors.label}
          />

          <FormField
            label="SIM Provider"
            name="simProvider"
            placeholder="e.g., AT&T, Verizon"
            register={register}
            error={errors.simProvider}
          />

          <TextAreaField
            label="Notes"
            name="notes"
            placeholder="Any additional notes..."
            register={register}
            error={errors.notes}
          />

          {/* WhatsApp Section */}
          <div className="border-t border-gray-200 pt-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                {...register('enableWhatsapp')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Enable WhatsApp</p>
                <p className="text-xs text-gray-500">
                  Set up a WhatsApp session for this number
                </p>
              </div>
            </label>

            {enableWhatsapp && (
              <div className="mt-4">
                <SelectField
                  label="Device"
                  name="deviceId"
                  options={devices.map((d) => ({
                    value: d.id,
                    label: `${d.friendlyName} (${d.deviceCode})`,
                  }))}
                  register={register}
                  error={errors.deviceId}
                  placeholder={loadingDevices ? 'Loading devices...' : 'Select a device'}
                  required
                />
                {devices.length === 0 && !loadingDevices && (
                  <p className="mt-2 text-xs text-yellow-600">
                    No devices available. Please register a device first.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={() => navigate('/phone-numbers')}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              Create Number
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditNumberPage;
