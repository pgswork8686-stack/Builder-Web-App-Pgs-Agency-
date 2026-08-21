"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Building2,
  FolderKanban,
  Layers,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  Wrench,
} from "lucide-react";
import {
  servicesApi,
  type ServiceCatalogItem,
  type ServiceCategory,
  type ServiceDeliveryItem,
} from "@/lib/api/services";
import {
  organizationApi,
  type Department,
  type Team,
} from "@/lib/api/organization";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

const emptyServiceForm = {
  code: "",
  name: "",
  description: "",
  categoryId: "",
  sortOrder: 0,
  active: true,
};

const emptyCategoryForm = {
  code: "",
  name: "",
  description: "",
  sortOrder: 0,
  isActive: true,
};

const emptyItemForm = {
  name: "",
  description: "",
  sortOrder: 0,
  isRequired: true,
  isActive: true,
};

const emptyResponsibilityForm = {
  ownerDepartmentId: "",
  ownerTeamId: "",
  collaboratorDepartmentIds: [] as string[],
  collaboratorTeamIds: [] as string[],
};

export function cleanCollaboratorTeamIds(
  collaboratorTeamIds: string[],
  ownerDepartmentId: string,
  ownerTeamId: string | null | undefined,
  collaboratorDepartmentIds: string[],
  teams: Array<{ id: string; departmentId?: string; department_id?: string }>,
): string[] {
  const allowedDepartmentIds = new Set([
    ownerDepartmentId,
    ...collaboratorDepartmentIds,
  ]);

  return collaboratorTeamIds.filter((teamId) => {
    if (teamId === ownerTeamId) return false;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return false;
    const teamDepartmentId = team.departmentId ?? team.department_id;
    return Boolean(
      teamDepartmentId && allowedDepartmentIds.has(teamDepartmentId),
    );
  });
}

export function ServiceCatalogView() {
  const [activeTab, setActiveTab] = useState<"services" | "categories">(
    "services",
  );

  // Categories state
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Services state
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // Delivery items modal state
  const [activeServiceForItems, setActiveServiceForItems] =
    useState<ServiceCatalogItem | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<ServiceDeliveryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);

  // Service responsibility state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeServiceForResponsibility, setActiveServiceForResponsibility] =
    useState<ServiceCatalogItem | null>(null);
  const [responsibilityForm, setResponsibilityForm] = useState(
    emptyResponsibilityForm,
  );
  const [loadingResponsibility, setLoadingResponsibility] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Categories
  const loadCategories = useCallback(async () => {
    try {
      const data = await servicesApi.listCategories();
      setCategories(data);
    } catch (err: any) {
      console.error("Failed to load service categories:", err);
    }
  }, []);

  // Load Services
  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await servicesApi.list({
        q: q || undefined,
        categoryId: selectedCategoryId || undefined,
        active: activeFilter ? activeFilter === "true" : undefined,
        page,
        pageSize: 50,
      });
      setServices(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tải danh mục dịch vụ.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeFilter, page, q, selectedCategoryId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    Promise.all([
      organizationApi.getDepartments(),
      organizationApi.getTeams({ isActive: true }),
    ])
      .then(([departmentRows, teamRows]) => {
        setDepartments(
          departmentRows.filter(
            (department) => department.isActive ?? department.is_active ?? true,
          ),
        );
        setTeams(
          teamRows.filter((team) => team.isActive ?? team.is_active ?? true),
        );
      })
      .catch((err) => {
        console.error("Failed to load organization options:", err);
      });
  }, []);

  useEffect(() => {
    if (activeTab === "services") {
      loadServices();
    }
  }, [activeTab, loadServices]);

  // Delivery Items loader
  const openDeliveryItemsModal = async (service: ServiceCatalogItem) => {
    setActiveServiceForItems(service);
    setLoadingItems(true);
    setShowItemForm(false);
    setItemForm(emptyItemForm);
    setEditingItemId(null);
    try {
      const items = await servicesApi.listDeliveryItems(service.id);
      setDeliveryItems(items);
    } catch (err: any) {
      console.error("Failed to load delivery items:", err);
    } finally {
      setLoadingItems(false);
    }
  };

  const openResponsibilityModal = async (service: ServiceCatalogItem) => {
    setActiveServiceForResponsibility(service);
    setLoadingResponsibility(true);
    try {
      const responsibility = await servicesApi.getResponsibilities(service.id);
      setResponsibilityForm({
        ownerDepartmentId: responsibility.ownerDepartment?.id ?? "",
        ownerTeamId: responsibility.ownerTeam?.id ?? "",
        collaboratorDepartmentIds: responsibility.collaboratingDepartments.map(
          (item) => item.id,
        ),
        collaboratorTeamIds: responsibility.collaboratingTeams.map(
          (item) => item.id,
        ),
      });
    } catch (err: any) {
      alert(err.message || "Không thể tải thông tin phụ trách dịch vụ.");
      setActiveServiceForResponsibility(null);
    } finally {
      setLoadingResponsibility(false);
    }
  };

  const handleSaveResponsibility = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeServiceForResponsibility) return;
    if (!responsibilityForm.ownerDepartmentId) {
      alert("Vui lòng chọn Owner Department.");
      return;
    }

    setSaving(true);
    try {
      await servicesApi.updateResponsibilities(
        activeServiceForResponsibility.id,
        {
          ownerDepartmentId: responsibilityForm.ownerDepartmentId,
          ownerTeamId: responsibilityForm.ownerTeamId || null,
          collaboratorDepartmentIds:
            responsibilityForm.collaboratorDepartmentIds,
          collaboratorTeamIds: responsibilityForm.collaboratorTeamIds,
        },
      );
      setActiveServiceForResponsibility(null);
      setResponsibilityForm(emptyResponsibilityForm);
      await loadServices();
    } catch (err: any) {
      alert(err.message || "Không thể cập nhật phụ trách dịch vụ.");
    } finally {
      setSaving(false);
    }
  };

  // Category CRUD
  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingCategoryId) {
        await servicesApi.updateCategory(editingCategoryId, {
          name: categoryForm.name.trim(),
          description: categoryForm.description?.trim() || null,
          sortOrder: categoryForm.sortOrder,
          isActive: categoryForm.isActive,
        });
      } else {
        await servicesApi.createCategory({
          code: categoryForm.code.trim().toUpperCase(),
          name: categoryForm.name.trim(),
          description: categoryForm.description?.trim() || null,
          sortOrder: categoryForm.sortOrder,
          isActive: categoryForm.isActive,
        });
      }
      setShowCategoryModal(false);
      setEditingCategoryId(null);
      setCategoryForm(emptyCategoryForm);
      await loadCategories();
    } catch (err: any) {
      setError(err.message || "Không thể lưu nhóm dịch vụ.");
    } finally {
      setSaving(false);
    }
  };

  // Service CRUD
  const handleSaveService = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: serviceForm.name.trim(),
        description: serviceForm.description?.trim() || null,
        categoryId: serviceForm.categoryId || undefined,
        sortOrder: serviceForm.sortOrder,
        active: serviceForm.active,
      };
      if (editingServiceId) {
        await servicesApi.update(editingServiceId, payload);
      } else {
        await servicesApi.create({
          ...payload,
          code: serviceForm.code.trim().toUpperCase() || undefined,
        });
      }
      setShowServiceModal(false);
      setEditingServiceId(null);
      setServiceForm(emptyServiceForm);
      await loadServices();
    } catch (err: any) {
      setError(err.message || "Không thể lưu dịch vụ.");
    } finally {
      setSaving(false);
    }
  };

  // Delivery Item CRUD
  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeServiceForItems) return;
    setSaving(true);
    try {
      if (editingItemId) {
        await servicesApi.updateDeliveryItem(
          activeServiceForItems.id,
          editingItemId,
          {
            name: itemForm.name.trim(),
            description: itemForm.description?.trim() || null,
            sortOrder: itemForm.sortOrder,
            isRequired: itemForm.isRequired,
            isActive: itemForm.isActive,
          },
        );
      } else {
        await servicesApi.createDeliveryItem(activeServiceForItems.id, {
          name: itemForm.name.trim(),
          description: itemForm.description?.trim() || null,
          sortOrder: itemForm.sortOrder,
          isRequired: itemForm.isRequired,
          isActive: itemForm.isActive,
        });
      }
      setShowItemForm(false);
      setEditingItemId(null);
      setItemForm(emptyItemForm);
      const items = await servicesApi.listDeliveryItems(
        activeServiceForItems.id,
      );
      setDeliveryItems(items);
    } catch (err: any) {
      alert(err.message || "Không thể lưu hạng mục.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!activeServiceForItems) return;
    if (!confirm("Bạn có chắc chắn muốn xóa/ngưng kích hoạt hạng mục này?"))
      return;
    try {
      await servicesApi.deleteDeliveryItem(activeServiceForItems.id, itemId);
      const items = await servicesApi.listDeliveryItems(
        activeServiceForItems.id,
      );
      setDeliveryItems(items);
    } catch (err: any) {
      alert(err.message || "Không thể xóa hạng mục.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Quản Lý Dịch Vụ & Hạng Mục Triển Khai"
        description="Quản trị 6 nhóm dịch vụ, 26 dịch vụ chuẩn và danh mục hạng mục triển khai mẫu."
        badge={`${categories.length} Nhóm | ${total} Dịch vụ`}
        action={
          <div className="flex items-center gap-3">
            <Link href="/app/admin">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Quản trị
              </Button>
            </Link>
            {activeTab === "categories" ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingCategoryId(null);
                  setCategoryForm(emptyCategoryForm);
                  setShowCategoryModal(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Thêm nhóm dịch vụ
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingServiceId(null);
                  setServiceForm(emptyServiceForm);
                  setShowServiceModal(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Thêm dịch vụ mới
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab("services")}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "services"
              ? "border-[#4F75FF] text-[#4F75FF]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <Layers className="w-4 h-4" />
          Danh mục dịch vụ ({total})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "categories"
              ? "border-[#4F75FF] text-[#4F75FF]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          Nhóm dịch vụ ({categories.length})
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="danger"
            size="sm"
            onClick={activeTab === "services" ? loadServices : loadCategories}
          >
            Thử lại
          </Button>
        </div>
      ) : null}

      {/* TAB 1: SERVICES */}
      {activeTab === "services" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="p-3 bg-white border border-[#E2E8F0] shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm kiếm dịch vụ theo tên, mã..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#4F75FF] focus:bg-white"
                />
              </div>

              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="py-1.5 px-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none text-[#0F172A] focus:border-[#4F75FF]"
              >
                <option value="">Tất cả nhóm dịch vụ</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.serviceCategoryCode}: {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
                className="py-1.5 px-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none text-[#0F172A] focus:border-[#4F75FF]"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Đang hoạt động</option>
                <option value="false">Tạm ngưng</option>
              </select>
            </div>
          </Card>

          {/* Services Table */}
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#64748B]">
                Đang tải danh mục dịch vụ...
              </div>
            ) : services.length === 0 ? (
              <EmptyState
                icon={<Wrench className="w-8 h-8 text-[#4F75FF]" />}
                title="Chưa có dịch vụ nào"
                description="Thêm dịch vụ đầu tiên để bắt đầu triển khai cho các dự án."
                actionLabel="Thêm dịch vụ"
                onAction={() => {
                  setEditingServiceId(null);
                  setServiceForm(emptyServiceForm);
                  setShowServiceModal(true);
                }}
              />
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Mã DV</TableHeaderCell>
                      <TableHeaderCell>Tên dịch vụ</TableHeaderCell>
                      <TableHeaderCell>Nhóm dịch vụ</TableHeaderCell>
                      <TableHeaderCell>Phụ trách</TableHeaderCell>
                      <TableHeaderCell>Hạng mục chuẩn</TableHeaderCell>
                      <TableHeaderCell>Trạng thái</TableHeaderCell>
                      <TableHeaderCell className="text-right">
                        Thao tác
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {services.map((svc) => (
                      <TableRow key={svc.id}>
                        <TableCell className="font-mono font-bold text-[#4F75FF]">
                          {svc.service_code || svc.serviceCode || svc.code}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-[#0F172A]">
                            {svc.name}
                          </div>
                          {svc.description && (
                            <div className="text-xs text-[#64748B] line-clamp-1 max-w-sm">
                              {svc.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {svc.category ? (
                            <Badge variant="default" size="sm">
                              {svc.category.service_category_code ||
                                svc.category.code}
                              : {svc.category.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">
                              Chưa gán
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const owner = svc.department_assignments?.find(
                              (item) => item.responsibility_role === "owner",
                            );
                            return owner ? (
                              <Badge variant="blue" size="sm">
                                {owner.department_code || "Đã gán"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-[#94A3B8]">
                                Chưa gán
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openDeliveryItemsModal(svc)}
                            leftIcon={<ListOrdered className="w-3.5 h-3.5" />}
                          >
                            Hạng mục (
                            {svc.delivery_items ? svc.delivery_items.length : 0}
                            )
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={svc.active ? "success" : "default"}
                            size="sm"
                          >
                            {svc.active ? "Đang hoạt động" : "Tạm ngưng"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openResponsibilityModal(svc)}
                              leftIcon={<Building2 className="w-3.5 h-3.5" />}
                            >
                              Phụ trách
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingServiceId(svc.id);
                                setServiceForm({
                                  code: svc.code,
                                  name: svc.name,
                                  description: svc.description ?? "",
                                  categoryId: svc.service_category_id ?? "",
                                  sortOrder: svc.sort_order ?? 0,
                                  active: svc.active,
                                });
                                setShowServiceModal(true);
                              }}
                              leftIcon={<Pencil className="w-3.5 h-3.5" />}
                            >
                              Sửa
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: CATEGORIES */}
      {activeTab === "categories" && (
        <Card className="p-0 overflow-hidden">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mã nhóm (NHDV)</TableHeaderCell>
                  <TableHeaderCell>Mã định danh</TableHeaderCell>
                  <TableHeaderCell>Tên nhóm dịch vụ</TableHeaderCell>
                  <TableHeaderCell>Số dịch vụ trực thuộc</TableHeaderCell>
                  <TableHeaderCell>Thứ tự</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Thao tác
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-mono font-bold text-[#4F75FF]">
                      {cat.serviceCategoryCode}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-[#0F172A]">
                      {cat.code}
                    </TableCell>
                    <TableCell className="font-bold text-[#0F172A]">
                      {cat.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="blue" size="sm">
                        {cat.servicesCount ?? 0} dịch vụ
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-[#64748B]">
                      {cat.sortOrder}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cat.isActive ? "success" : "default"}
                        size="sm"
                      >
                        {cat.isActive ? "Đang hoạt động" : "Tạm ngưng"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setCategoryForm({
                            code: cat.code,
                            name: cat.name,
                            description: cat.description ?? "",
                            sortOrder: cat.sortOrder,
                            isActive: cat.active ?? cat.isActive ?? true,
                          });
                          setShowCategoryModal(true);
                        }}
                        leftIcon={<Pencil className="w-3.5 h-3.5" />}
                      >
                        Sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Modal: Service Form */}
      {showServiceModal && (
        <Dialog
          isOpen={showServiceModal}
          onClose={() => setShowServiceModal(false)}
          maxWidth="md"
          title={editingServiceId ? "Chỉnh sửa dịch vụ" : "Tạo dịch vụ mới"}
          description="Thiết lập thông tin dịch vụ và liên kết với Nhóm dịch vụ phù hợp."
        >
          <form onSubmit={handleSaveService} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Tên dịch vụ *
              </label>
              <input
                type="text"
                required
                value={serviceForm.name}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, name: e.target.value })
                }
                placeholder="VD: Thiết kế Website, Google Ads..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Nhóm dịch vụ (Category)
              </label>
              <select
                value={serviceForm.categoryId}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, categoryId: e.target.value })
                }
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                <option value="">-- Chọn nhóm dịch vụ --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.serviceCategoryCode}: {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mã kỹ thuật (Tùy chọn)
              </label>
              <input
                type="text"
                value={serviceForm.code}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="VD: WEB_DESIGN (Hệ thống tự sinh DV_XX)"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mô tả dịch vụ
              </label>
              <textarea
                rows={3}
                value={serviceForm.description}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    description: e.target.value,
                  })
                }
                placeholder="Mô tả phạm vi, quy cách cung cấp dịch vụ..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={serviceForm.active}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      active: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#4F75FF] cursor-pointer"
                />
                Dịch vụ đang hoạt động
              </label>
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowServiceModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
                isLoading={saving}
              >
                Lưu dịch vụ
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Modal: Category Form */}
      {showCategoryModal && (
        <Dialog
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          maxWidth="md"
          title={
            editingCategoryId
              ? "Chỉnh sửa nhóm dịch vụ"
              : "Tạo nhóm dịch vụ mới"
          }
          description="Thiết lập nhóm dịch vụ chuẩn để phân loại các dịch vụ trong hệ thống."
        >
          <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mã nhóm (Code) *
              </label>
              <input
                type="text"
                required
                disabled={!!editingCategoryId}
                value={categoryForm.code}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="VD: WEBSITE_SEO, PERFORMANCE..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Tên nhóm dịch vụ *
              </label>
              <input
                type="text"
                required
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder="VD: Website & SEO"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                Mô tả nhóm
              </label>
              <textarea
                rows={3}
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: e.target.value,
                  })
                }
                placeholder="Mô tả phạm vi nhóm dịch vụ..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] resize-none"
              />
            </div>

            <div className="border-t border-[#EDF2F7] pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCategoryModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
                isLoading={saving}
              >
                Lưu nhóm dịch vụ
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Modal: Service Responsibility */}
      {activeServiceForResponsibility && (
        <Dialog
          isOpen={!!activeServiceForResponsibility}
          onClose={() => setActiveServiceForResponsibility(null)}
          maxWidth="lg"
          title={`Phụ trách dịch vụ: ${activeServiceForResponsibility.name}`}
          description="Thiết lập phòng ban/Team chủ quản và các đơn vị phối hợp. Team chủ quản bắt buộc phải thuộc phòng ban chủ quản."
        >
          {loadingResponsibility ? (
            <div className="py-10 text-center text-xs text-[#64748B]">
              Đang tải thông tin phụ trách...
            </div>
          ) : (
            <form
              onSubmit={handleSaveResponsibility}
              className="space-y-5 pt-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                    Owner Department *
                  </label>
                  <select
                    required
                    value={responsibilityForm.ownerDepartmentId}
                    onChange={(e) => {
                      const nextOwnerDepartmentId = e.target.value;
                      const nextOwnerTeamId = teams.some(
                        (team) =>
                          team.id === responsibilityForm.ownerTeamId &&
                          (team.departmentId ?? team.department_id) ===
                            nextOwnerDepartmentId,
                      )
                        ? responsibilityForm.ownerTeamId
                        : "";
                      const nextCollaboratorDepartmentIds =
                        responsibilityForm.collaboratorDepartmentIds.filter(
                          (id) => id !== nextOwnerDepartmentId,
                        );
                      const nextCollaboratorTeamIds = cleanCollaboratorTeamIds(
                        responsibilityForm.collaboratorTeamIds,
                        nextOwnerDepartmentId,
                        nextOwnerTeamId,
                        nextCollaboratorDepartmentIds,
                        teams,
                      );

                      setResponsibilityForm({
                        ownerDepartmentId: nextOwnerDepartmentId,
                        ownerTeamId: nextOwnerTeamId,
                        collaboratorDepartmentIds:
                          nextCollaboratorDepartmentIds,
                        collaboratorTeamIds: nextCollaboratorTeamIds,
                      });
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                  >
                    <option value="">-- Chọn phòng chủ quản --</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.departmentCode}: {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase mb-1">
                    Owner Team
                  </label>
                  <select
                    value={responsibilityForm.ownerTeamId}
                    onChange={(e) => {
                      const nextOwnerTeamId = e.target.value;
                      const nextCollaboratorTeamIds = cleanCollaboratorTeamIds(
                        responsibilityForm.collaboratorTeamIds,
                        responsibilityForm.ownerDepartmentId,
                        nextOwnerTeamId,
                        responsibilityForm.collaboratorDepartmentIds,
                        teams,
                      );

                      setResponsibilityForm({
                        ...responsibilityForm,
                        ownerTeamId: nextOwnerTeamId,
                        collaboratorTeamIds: nextCollaboratorTeamIds,
                      });
                    }}
                    disabled={!responsibilityForm.ownerDepartmentId}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] disabled:opacity-60"
                  >
                    <option value="">-- Chưa gán Team chủ quản --</option>
                    {teams
                      .filter(
                        (team) =>
                          (team.departmentId ?? team.department_id) ===
                          responsibilityForm.ownerDepartmentId,
                      )
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.teamCode || team.team_code || team.code}:{" "}
                          {team.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-[#4F75FF]" />
                  <span className="text-xs font-bold text-[#0F172A]">
                    Phòng ban phối hợp
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  {departments
                    .filter(
                      (department) =>
                        department.id !== responsibilityForm.ownerDepartmentId,
                    )
                    .map((department) => {
                      const checked =
                        responsibilityForm.collaboratorDepartmentIds.includes(
                          department.id,
                        );
                      return (
                        <label
                          key={department.id}
                          className="flex items-center gap-2 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextCollaboratorDepartmentIds = e.target
                                .checked
                                ? [
                                    ...responsibilityForm.collaboratorDepartmentIds,
                                    department.id,
                                  ]
                                : responsibilityForm.collaboratorDepartmentIds.filter(
                                    (id) => id !== department.id,
                                  );
                              const nextCollaboratorTeamIds =
                                cleanCollaboratorTeamIds(
                                  responsibilityForm.collaboratorTeamIds,
                                  responsibilityForm.ownerDepartmentId,
                                  responsibilityForm.ownerTeamId,
                                  nextCollaboratorDepartmentIds,
                                  teams,
                                );

                              setResponsibilityForm({
                                ...responsibilityForm,
                                collaboratorDepartmentIds:
                                  nextCollaboratorDepartmentIds,
                                collaboratorTeamIds: nextCollaboratorTeamIds,
                              });
                            }}
                            className="w-4 h-4 accent-[#4F75FF]"
                          />
                          <span className="font-mono text-[#4F75FF]">
                            {department.departmentCode}
                          </span>
                          <span>{department.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UsersRound className="w-4 h-4 text-[#4F75FF]" />
                  <span className="text-xs font-bold text-[#0F172A]">
                    Team phối hợp
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  {teams.filter((team) => {
                    const departmentId =
                      team.departmentId ?? team.department_id;
                    return (
                      team.id !== responsibilityForm.ownerTeamId &&
                      [
                        responsibilityForm.ownerDepartmentId,
                        ...responsibilityForm.collaboratorDepartmentIds,
                      ].includes(departmentId)
                    );
                  }).length === 0 ? (
                    <div className="text-xs text-[#94A3B8]">
                      Chưa có Team phù hợp. Có thể lưu Owner Department trước và
                      gán Team sau.
                    </div>
                  ) : (
                    teams
                      .filter((team) => {
                        const departmentId =
                          team.departmentId ?? team.department_id;
                        return (
                          team.id !== responsibilityForm.ownerTeamId &&
                          [
                            responsibilityForm.ownerDepartmentId,
                            ...responsibilityForm.collaboratorDepartmentIds,
                          ].includes(departmentId)
                        );
                      })
                      .map((team) => {
                        const checked =
                          responsibilityForm.collaboratorTeamIds.includes(
                            team.id,
                          );
                        return (
                          <label
                            key={team.id}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [
                                      ...responsibilityForm.collaboratorTeamIds,
                                      team.id,
                                    ]
                                  : responsibilityForm.collaboratorTeamIds.filter(
                                      (id) => id !== team.id,
                                    );
                                setResponsibilityForm({
                                  ...responsibilityForm,
                                  collaboratorTeamIds: ids,
                                });
                              }}
                              className="w-4 h-4 accent-[#4F75FF]"
                            />
                            <span className="font-mono text-[#4F75FF]">
                              {team.teamCode || team.team_code || team.code}
                            </span>
                            <span>{team.name}</span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="border-t border-[#EDF2F7] pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveServiceForResponsibility(null)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  isLoading={saving}
                >
                  Lưu phụ trách
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}

      {/* Modal: Service Delivery Items (Hạng mục chuẩn) */}
      {activeServiceForItems && (
        <Dialog
          isOpen={!!activeServiceForItems}
          onClose={() => setActiveServiceForItems(null)}
          maxWidth="lg"
          title={`Hạng mục triển khai chuẩn: ${activeServiceForItems.name}`}
          description={`Các hạng mục mẫu sẽ tự động được sao chép sang dự án khi dịch vụ (${activeServiceForItems.service_code || activeServiceForItems.code}) được gán vào dự án.`}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Danh sách hạng mục ({deliveryItems.length})
              </span>
              {!showItemForm && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingItemId(null);
                    setItemForm(emptyItemForm);
                    setShowItemForm(true);
                  }}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Thêm hạng mục mẫu
                </Button>
              )}
            </div>

            {/* Inline Add / Edit Form */}
            {showItemForm && (
              <Card className="p-4 bg-[#F8FAFC] border border-[#CBD5E1]">
                <form onSubmit={handleSaveItem} className="space-y-3">
                  <div className="font-semibold text-xs text-[#0F172A]">
                    {editingItemId
                      ? "Chỉnh sửa hạng mục mẫu"
                      : "Thêm hạng mục triển khai mẫu"}
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">
                      Tên hạng mục *
                    </label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, name: e.target.value })
                      }
                      placeholder="VD: Khảo sát yêu cầu, Thiết kế wireframe..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">
                      Mô tả / Hướng dẫn triển khai
                    </label>
                    <textarea
                      rows={2}
                      value={itemForm.description}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Nội dung, tiêu chuẩn đầu ra của hạng mục..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF] resize-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemForm.isRequired}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            isRequired: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#4F75FF]"
                      />
                      Hạng mục bắt buộc
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemForm.isActive}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#4F75FF]"
                      />
                      Đang hoạt động
                    </label>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowItemForm(false)}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={saving}
                      isLoading={saving}
                    >
                      Lưu hạng mục
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Delivery Items List */}
            {loadingItems ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                Đang tải hạng mục...
              </div>
            ) : deliveryItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                Chưa có hạng mục mẫu nào cho dịch vụ này.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {deliveryItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex items-center justify-between hover:border-[#CBD5E1] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#4F75FF] font-mono text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#0F172A]">
                            {item.name}
                          </span>
                          <span className="font-mono text-[10px] text-[#4F75FF] bg-blue-50 px-1.5 py-0.5 rounded">
                            {item.delivery_item_code}
                          </span>
                          <Badge
                            variant={item.is_required ? "success" : "default"}
                            size="sm"
                          >
                            {item.is_required ? "Bắt buộc" : "Tùy chọn"}
                          </Badge>
                        </div>
                        {item.description && (
                          <div className="text-xs text-[#64748B] mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingItemId(item.id);
                          setItemForm({
                            name: item.name,
                            description: item.description ?? "",
                            sortOrder: item.sort_order,
                            isRequired:
                              item.is_required ?? item.isRequired ?? true,
                            isActive: item.active ?? item.is_active ?? true,
                          });
                          setShowItemForm(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[#EDF2F7] pt-3 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveServiceForItems(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
