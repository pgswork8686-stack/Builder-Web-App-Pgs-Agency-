import { request } from "./client";

export interface Contract {
  id: string;
  contract_number: string;
  contract_code?: string;
  client_company_id: string;
  project_id: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  contract_value: number;
  currency_code: string;
  status: "draft" | "active" | "completed" | "cancelled";
  notes?: string | null;
  client_visible: boolean;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  client_company?: {
    name: string;
    client_code?: string;
  };
  project?: {
    name: string;
    project_code?: string;
  };
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_code?: string;
  client_company_id: string;
  project_id: string | null;
  contract_id: string | null;
  issue_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  currency_code: string;
  status:
    "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
  paid_at: string | null;
  cancelled_at: string | null;
  notes?: string | null;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  client_company?: {
    name: string;
  };
  project?: {
    name: string;
  };
  contract?: {
    contract_number: string;
  };
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string;
  paymentReference: string | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  recordedBy?: string | null;
}

export interface AuditLog {
  id: string;
  entity_type: "contract" | "invoice" | "payment";
  entity_id: string;
  action: string;
  actor_user_id: string;
  previous_data: any | null;
  new_data: any;
  created_at: string;
  actor?: {
    full_name: string | null;
    email: string | null;
  };
}

export interface FinanceQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: string;
  clientCompanyId?: string;
  projectId?: string;
  contractId?: string;
}

export const financeApi = {
  getSummary: (): Promise<any> => {
    return request("/finance/summary");
  },

  getContracts: (
    query: FinanceQuery = {},
  ): Promise<{
    items: Contract[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());
    if (query.query) params.append("query", query.query);
    if (query.status) params.append("status", query.status);
    if (query.clientCompanyId)
      params.append("clientCompanyId", query.clientCompanyId);
    if (query.projectId) params.append("projectId", query.projectId);

    return request(`/finance/contracts?${params.toString()}`);
  },

  getContractById: (id: string): Promise<Contract> => {
    return request(`/finance/contracts/${id}`);
  },

  createContract: (payload: {
    contractNumber: string;
    clientCompanyId: string;
    projectId?: string | null;
    title: string;
    startDate: string;
    endDate?: string | null;
    contractValue: number;
    currencyCode: string;
    notes?: string | null;
    clientVisible?: boolean;
  }): Promise<Contract> => {
    return request("/finance/contracts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateContract: (
    id: string,
    payload: Partial<{
      contractNumber: string;
      clientCompanyId: string;
      projectId: string | null;
      title: string;
      startDate: string;
      endDate: string | null;
      contractValue: number;
      currencyCode: string;
      notes: string | null;
      clientVisible: boolean;
    }>,
  ): Promise<Contract> => {
    return request(`/finance/contracts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  transitionContract: (id: string, status: string): Promise<Contract> => {
    return request(`/finance/contracts/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  getInvoices: (
    query: FinanceQuery = {},
  ): Promise<{
    items: Invoice[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());
    if (query.query) params.append("query", query.query);
    if (query.status) params.append("status", query.status);
    if (query.clientCompanyId)
      params.append("clientCompanyId", query.clientCompanyId);
    if (query.projectId) params.append("projectId", query.projectId);
    if (query.contractId) params.append("contractId", query.contractId);

    return request(`/finance/invoices?${params.toString()}`);
  },

  getInvoiceById: (id: string): Promise<Invoice> => {
    return request(`/finance/invoices/${id}`);
  },

  createInvoice: (payload: {
    invoiceNumber: string;
    clientCompanyId: string;
    projectId?: string | null;
    contractId?: string | null;
    issueDate: string;
    dueDate: string;
    amount: number;
    currencyCode: string;
    notes?: string | null;
    clientVisible?: boolean;
  }): Promise<Invoice> => {
    return request("/finance/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateInvoice: (
    id: string,
    payload: Partial<{
      invoiceNumber: string;
      clientCompanyId: string;
      projectId: string | null;
      contractId: string | null;
      issueDate: string;
      dueDate: string;
      amount: number;
      currencyCode: string;
      notes: string | null;
      clientVisible: boolean;
    }>,
  ): Promise<Invoice> => {
    return request(`/finance/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  transitionInvoice: (id: string, status: string): Promise<Invoice> => {
    return request(`/finance/invoices/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  recordPayment: (
    invoiceId: string,
    payload: {
      amount: number;
      paidAt: string;
      paymentReference?: string | null;
      paymentMethod?: string | null;
      notes?: string | null;
    },
  ): Promise<{ invoice: Invoice; payment: Payment }> => {
    return request(`/finance/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getPayments: (invoiceId: string): Promise<Payment[]> => {
    return request(`/finance/invoices/${invoiceId}/payments`);
  },

  getAuditLogs: (
    query: { page?: number; pageSize?: number } = {},
  ): Promise<{
    items: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());

    return request(`/finance/audit?${params.toString()}`);
  },

  getMetaClients: (
    query: FinanceQuery = {},
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());
    if (query.query) params.append("query", query.query);

    return request(`/finance/meta/clients?${params.toString()}`);
  },

  getMetaProjects: (
    query: FinanceQuery = {},
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());
    if (query.query) params.append("query", query.query);
    if (query.clientCompanyId)
      params.append("clientCompanyId", query.clientCompanyId);

    return request(`/finance/meta/projects?${params.toString()}`);
  },

  getMetaContracts: (
    query: FinanceQuery = {},
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());
    if (query.query) params.append("query", query.query);
    if (query.clientCompanyId)
      params.append("clientCompanyId", query.clientCompanyId);
    if (query.projectId) params.append("projectId", query.projectId);
    if (query.status) params.append("status", query.status);

    return request(`/finance/meta/contracts?${params.toString()}`);
  },
};
