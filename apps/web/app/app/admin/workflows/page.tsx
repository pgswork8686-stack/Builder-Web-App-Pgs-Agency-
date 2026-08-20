'use client';

import { useCallback, useEffect, useState } from 'react';
import { workflowsApi, WorkflowTemplate } from '@/lib/api/workflows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, GitFork, Clock } from 'lucide-react';

export default function AdminWorkflowsPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await workflowsApi.listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load workflow templates', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quy trình dịch vụ (Workflow Engine V1)</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý quy trình chuẩn, các giai đoạn (Stages) và phân bổ công việc.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Tạo mẫu quy trình mới
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Đang tải danh sách quy trình...</div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Chưa có mẫu quy trình nào. Hãy tạo mẫu quy trình đầu tiên cho Service Catalog.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col justify-between hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted font-medium">
                    {tpl.workflow_code || 'QTDV'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {tpl.is_default && (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-[10px]">
                        Mặc định
                      </Badge>
                    )}
                    <Badge
                      variant={tpl.status === 'published' ? 'default' : 'outline'}
                      className="text-[10px] capitalize"
                    >
                      {tpl.status === 'published' ? 'Đã phát hành' : 'Bản nháp'} (v{tpl.version})
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{tpl.name}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">
                  {tpl.description || 'Chưa có mô tả chi tiết'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-xs space-y-2 border-t pt-3 mt-auto">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitFork className="h-3.5 w-3.5" /> {tpl.stages?.length || 0} giai đoạn
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> SLA tự động
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}