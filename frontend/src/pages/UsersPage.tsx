import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SearchInput } from '@/components/shared/SearchInput';
import { Pagination } from '@/components/shared/Pagination';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { FormField, SelectField } from '@/components/shared/FormField';
import { Plus, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AppUser } from '@/types';
import { UserRole, UserStatus } from '@/types';

const createUserSchema = z.object({
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Name is required').optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type UpdateUserFormData = z.infer<typeof updateUserSchema>;

const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, page }],
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        page,
        pageSize: 20,
      }),
  });

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: UserRole.VIEWER },
  });

  const updateForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserFormData) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateDialog(false);
      createForm.reset();
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserFormData }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      updateForm.reset();
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to update user');
    },
  });

  const columns: Column<AppUser>[] = [
    {
      key: 'fullName',
      header: 'Name',
      sortable: true,
      render: (item) => item.fullName,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (item) => item.email,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (item) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            item.role === 'ADMIN'
              ? 'bg-purple-100 text-purple-800'
              : item.role === 'EDITOR'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {item.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => (
        <StatusBadge
          label={item.status}
          variant={item.status === 'ACTIVE' ? 'success' : 'gray'}
        />
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      sortable: true,
      render: (item) =>
        item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingUser(item);
            updateForm.reset({
              fullName: item.fullName,
              role: item.role,
              status: item.status,
            });
          }}
          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          <Edit className="h-3 w-3" />
          Edit
        </button>
      ),
    },
  ];

  const roleOptions = [
    { value: UserRole.ADMIN, label: 'Admin' },
    { value: UserRole.EDITOR, label: 'Editor' },
    { value: UserRole.VIEWER, label: 'Viewer' },
  ];

  const statusOptions = [
    { value: UserStatus.ACTIVE, label: 'Active' },
    { value: UserStatus.DISABLED, label: 'Disabled' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Access</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage dashboard users and their roles
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search users..."
        className="w-64"
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        emptyTitle="No users found"
      />

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Create User Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateDialog(false)} />
          <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl animate-fade-in">
            <h3 className="text-lg font-medium text-gray-900">Create User</h3>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form
              onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))}
              className="mt-4 space-y-4"
            >
              <FormField
                label="Full Name"
                name="fullName"
                register={createForm.register}
                error={createForm.formState.errors.fullName}
                required
              />
              <FormField
                label="Email"
                name="email"
                type="email"
                register={createForm.register}
                error={createForm.formState.errors.email}
                required
              />
              <FormField
                label="Password"
                name="password"
                type="password"
                register={createForm.register}
                error={createForm.formState.errors.password}
                required
              />
              <SelectField
                label="Role"
                name="role"
                options={roleOptions}
                register={createForm.register}
                error={createForm.formState.errors.role}
                required
              />

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateDialog(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditingUser(null)} />
          <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl animate-fade-in">
            <h3 className="text-lg font-medium text-gray-900">Edit User</h3>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form
              onSubmit={updateForm.handleSubmit((data) =>
                updateMutation.mutate({ id: editingUser.id, data })
              )}
              className="mt-4 space-y-4"
            >
              <FormField
                label="Full Name"
                name="fullName"
                register={updateForm.register}
                error={updateForm.formState.errors.fullName}
              />
              <SelectField
                label="Role"
                name="role"
                options={roleOptions}
                register={updateForm.register}
                error={updateForm.formState.errors.role}
              />
              <SelectField
                label="Status"
                name="status"
                options={statusOptions}
                register={updateForm.register}
                error={updateForm.formState.errors.status}
              />
              <FormField
                label="New Password (optional)"
                name="password"
                type="password"
                register={updateForm.register}
                error={updateForm.formState.errors.password}
                helpText="Leave blank to keep current password"
              />

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
