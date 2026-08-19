import { request } from "./client";

export interface CompanyDocument {
  id: string;
  document_code?: string;
  title: string;
  description?: string | null;
  category:
    | "policy_procedure"
    | "contract_template"
    | "marketing_asset"
    | "brand_guidelines"
    | "financial_report"
    | "general";
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  access_level: "public_company" | "internal_only" | "management_only";
  department_id?: string | null;
  department_code?: string | null;
  uploaded_by_user_id: string;
  uploaded_by_user_code?: string | null;
  version: string;
  delete_status: "active" | "deleted";
  created_at: string;
  updated_at: string;
  department?: {
    id: string;
    name: string;
    department_code?: string;
  };
  uploaded_by?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
  };
}

export interface DocumentsListResponse {
  items: CompanyDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchDocuments(params?: {
  category?: string;
  departmentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<DocumentsListResponse> {
  const query = new URLSearchParams();
  if (params?.category) query.append("category", params.category);
  if (params?.departmentId) query.append("departmentId", params.departmentId);
  if (params?.search) query.append("search", params.search);
  if (params?.page) query.append("page", String(params.page));
  if (params?.pageSize) query.append("pageSize", String(params.pageSize));

  const qs = query.toString();
  return request<DocumentsListResponse>(`/documents${qs ? `?${qs}` : ""}`);
}

export async function createDocumentUploadSession(data: {
  title: string;
  description?: string | null;
  category: string;
  accessLevel?: string;
  departmentId?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version?: string;
}): Promise<{ storagePath: string; signedUrl: string; token: string }> {
  return request<{ storagePath: string; signedUrl: string; token: string }>(
    "/documents/upload-session",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function finalizeDocument(data: {
  title: string;
  description?: string | null;
  category: string;
  accessLevel?: string;
  departmentId?: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version?: string;
}): Promise<CompanyDocument> {
  return request<CompanyDocument>("/documents/finalize", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getDocumentDownloadUrl(
  id: string,
): Promise<{ id: string; fileName: string; downloadUrl: string }> {
  return request<{ id: string; fileName: string; downloadUrl: string }>(
    `/documents/${id}/download`,
  );
}

export async function deleteDocument(
  id: string,
): Promise<{ ok: boolean; id: string }> {
  return request<{ ok: boolean; id: string }>(`/documents/${id}`, {
    method: "DELETE",
  });
}
