import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type {
  CreateEmployeeResponse,
  Department,
  Employee,
  EmployeeDetail,
  EmployeeInput,
  EmployeeListParams,
  EmployeeUpdateInput,
  Paginated,
  Position,
} from '@/types/api'

export const masterApi = {
  departments: () => apiGet<Department[]>('/departments'),
  positions: (departmentId?: string) =>
    apiGet<Position[]>('/positions', { params: departmentId ? { departmentId } : undefined }),
}

export const employeesApi = {
  list: (params: EmployeeListParams) => apiGet<Paginated<Employee>>('/employees', { params }),
  detail: (id: string) => apiGet<EmployeeDetail>(`/employees/${id}`),
  create: (input: EmployeeInput) => apiPost<CreateEmployeeResponse>('/employees', input),
  update: (id: string, input: EmployeeUpdateInput) => apiPatch<Employee>(`/employees/${id}`, input),
  setStatus: (id: string, isActive: boolean, reason?: string) =>
    apiPatch<Employee>(`/employees/${id}/status`, { isActive, reason }),
  resetPassword: (id: string) => apiPost<{ temporaryPassword: string }>(`/employees/${id}/reset-password`),
}
