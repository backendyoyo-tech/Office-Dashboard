import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { platformAccountsApi, phoneNumbersApi, platformsApi } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { FormField, SelectField, TextAreaField } from '@/components/shared/FormField';
import { ArrowLeft, Link as LinkIcon } from 'lucide-react';
import type { Platform, AccountStatus, RelationshipType } from '@/types';

const accountSchema = z.object({
  platformId: z.coerce.number().min(1, 'Platform is required'),
  displayName: z.string().optional(),
  accountHandle: z.string().optional(),
  loginIdentifier: z.string().email('Invalid email format').optional().or(z.literal('')),
  profileUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  externalAccountId: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  accountStatus: z.enum(['ACTIVE', 'INACTIVE', 'LOGIN_ISSUE', 'SUSPENDED', 'UNKNOWN']).default('UNKNOWN'),
  notes: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

const AddAccountPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: platforms } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => platformsApi.list(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      accountStatus: 'UNKNOWN',
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: AccountFormData) => {
      const { password, ...accountData } = data;
      return platformAccountsApi.create({
        ...accountData,
        loginIdentifier: data.loginIdentifier || undefined,
        profileUrl: data.profileUrl || undefined,
        password: data.password || undefined,
        accountStatus: data.accountStatus as AccountStatus,
      });
    },
    onSuccess: async (account) => {
      // Now link the account to the phone number
      await phoneNumbersApi.linkAccount(id!, {
        platformAccountId: account.id,
        relationshipType: 'GENERAL' as RelationshipType,
      });
      navigate(`/phone-numbers/${id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create and link account');
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/phone-numbers/${id}`)}
          className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add & Link Account</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new platform account and link it to this phone number
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form
          onSubmit={handleSubmit((data) => createAccountMutation.mutate(data))}
          className="space-y-6"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Platform */}
          <SelectField
            label="Platform"
            name="platformId"
            options={platforms?.map((p: Platform) => ({
              value: String(p.id),
              label: p.displayName,
            })) || []}
            register={register}
            error={errors.platformId}
            placeholder="Select platform"
            required
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              label="Display Name"
              name="displayName"
              placeholder="e.g., Business Instagram"
              register={register}
              error={errors.displayName}
            />

            <FormField
              label="Account Handle / Username"
              name="accountHandle"
              placeholder="e.g., @businessname"
              register={register}
              error={errors.accountHandle}
            />
          </div>

          <FormField
            label="Login Email"
            name="loginIdentifier"
            placeholder="login@example.com"
            register={register}
            error={errors.loginIdentifier}
            type="email"
          />

          <FormField
            label="Profile URL"
            name="profileUrl"
            placeholder="https://instagram.com/businessname"
            register={register}
            error={errors.profileUrl}
            type="url"
          />

          <FormField
            label="External Account ID"
            name="externalAccountId"
            placeholder="Platform-specific ID (optional)"
            register={register}
            error={errors.externalAccountId}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password <span className="text-gray-400">(optional - for credential storage)</span>
            </label>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••"
              className={`mt-1 block w-full rounded-lg border ${
                errors.password ? 'border-red-300' : 'border-gray-300'
              } bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <SelectField
            label="Account Status"
            name="accountStatus"
            options={[
              { value: 'UNKNOWN', label: 'UNKNOWN' },
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'INACTIVE', label: 'INACTIVE' },
              { value: 'LOGIN_ISSUE', label: 'LOGIN_ISSUE' },
              { value: 'SUSPENDED', label: 'SUSPENDED' },
            ]}
            register={register}
            error={errors.accountStatus}
            required
          />

          <TextAreaField
            label="Notes"
            name="notes"
            placeholder="Any additional notes..."
            register={register}
            error={errors.notes}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={() => navigate(`/phone-numbers/${id}`)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createAccountMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createAccountMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              <LinkIcon className="h-4 w-4" />
              Create & Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAccountPage;