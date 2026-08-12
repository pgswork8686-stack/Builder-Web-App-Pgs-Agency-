import type { Paginated } from "./projects";
import { request } from "./client";

export interface ProjectFile {
  id: string;
  projectId: string;
  taskId?: string | null;
  uploadedBy: string;
  uploader?: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
  task?: { id: string; title: string } | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  fileCategory?: string | null;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
}

export interface UploadAuthorization {
  uploadSessionId: string;
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  expiresAt: string;
}

interface FileFilters {
  q?: string;
  taskId?: string;
  mimeType?: string;
  page?: number;
  pageSize?: number;
}

function paramsFrom(filters: FileFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export function uploadToSignedUrl(
  authorization: UploadAuthorization,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", authorization.signedUrl);
    request.setRequestHeader("x-upsert", "false");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("Không thể tải tệp lên kho lưu trữ."));
      }
    });
    request.addEventListener("error", () =>
      reject(new Error("Kết nối tải tệp bị gián đoạn.")),
    );
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    request.send(body);
  });
}

function scope(projectId: string, taskId?: string) {
  return taskId
    ? `/projects/${projectId}/tasks/${taskId}/files`
    : `/projects/${projectId}/files`;
}

export const filesApi = {
  list(projectId: string, filters: FileFilters = {}, taskId?: string) {
    return request<Paginated<ProjectFile>>(
      `${scope(projectId, taskId)}?${paramsFrom(filters)}`,
    );
  },
  requestUpload(projectId: string, file: File, taskId?: string) {
    return request<UploadAuthorization>(
      `${scope(projectId, taskId)}/upload-request`,
      {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      },
    );
  },
  finalize(projectId: string, uploadSessionId: string, taskId?: string) {
    return request<ProjectFile>(`${scope(projectId, taskId)}/finalize`, {
      method: "POST",
      body: JSON.stringify({ uploadSessionId }),
    });
  },
  download(projectId: string, fileId: string) {
    return request<{ signedUrl: string; expiresIn: number }>(
      `/projects/${projectId}/files/${fileId}/download`,
    );
  },
  remove(projectId: string, fileId: string) {
    return request<{ success: boolean }>(
      `/projects/${projectId}/files/${fileId}`,
      { method: "DELETE" },
    );
  },
};
