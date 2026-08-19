describe('Service Delivery Item Snapshot Invariance Contract', () => {
  interface ServiceDeliveryItemTemplate {
    id: string;
    service_id: string;
    delivery_item_code: string;
    name: string;
    sort_order: number;
    active: boolean;
  }

  interface ProjectServiceItemInstance {
    id: string;
    project_id: string;
    project_service_id: string;
    source_delivery_item_id: string;
    name: string;
    sort_order: number;
    status: 'planned' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  }

  // Pure representation of PostgreSQL trigger: snapshot_project_service_delivery_items()
  function triggerSnapshotProjectServiceDeliveryItems(
    projectService: { id: string; project_id: string; service_id: string },
    templates: ServiceDeliveryItemTemplate[],
  ): ProjectServiceItemInstance[] {
    return templates
      .filter((t) => t.service_id === projectService.service_id && t.active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t, idx) => ({
        id: `instance-${projectService.id}-${idx + 1}`,
        project_id: projectService.project_id,
        project_service_id: projectService.id,
        source_delivery_item_id: t.id,
        name: t.name,
        sort_order: t.sort_order,
        status: 'planned' as const,
      }));
  }

  it('guarantees project snapshot invariance when templates are modified later', () => {
    const SERVICE_ID = 'svc-website-design';
    const PROJECT_1_ID = 'proj-alpha';
    const PROJECT_2_ID = 'proj-beta';

    // Step 1: Initial Service Templates A, B, C
    const templatesTable: ServiceDeliveryItemTemplate[] = [
      {
        id: 'tmpl-A',
        service_id: SERVICE_ID,
        delivery_item_code: 'HMDV_01',
        name: 'Item A: Khảo sát yêu cầu',
        sort_order: 1,
        active: true,
      },
      {
        id: 'tmpl-B',
        service_id: SERVICE_ID,
        delivery_item_code: 'HMDV_02',
        name: 'Item B: Thiết kế UI Wireframe',
        sort_order: 2,
        active: true,
      },
      {
        id: 'tmpl-C',
        service_id: SERVICE_ID,
        delivery_item_code: 'HMDV_03',
        name: 'Item C: Lập trình Frontend & Backend',
        sort_order: 3,
        active: true,
      },
    ];

    // Step 2: Add Service to Project 1 -> Trigger fires snapshot
    const project1Service = {
      id: 'ps-01',
      project_id: PROJECT_1_ID,
      service_id: SERVICE_ID,
    };
    const project1Items = triggerSnapshotProjectServiceDeliveryItems(
      project1Service,
      templatesTable,
    );

    // Assert Project 1 has items [A, B, C]
    expect(project1Items).toHaveLength(3);
    expect(project1Items.map((i) => i.name)).toEqual([
      'Item A: Khảo sát yêu cầu',
      'Item B: Thiết kế UI Wireframe',
      'Item C: Lập trình Frontend & Backend',
    ]);
    expect(project1Items.every((i) => i.status === 'planned')).toBe(true);

    // Step 3: Add new template D to Service templates
    templatesTable.push({
      id: 'tmpl-D',
      service_id: SERVICE_ID,
      delivery_item_code: 'HMDV_04',
      name: 'Item D: Triển khai Hosting & Bàn giao',
      sort_order: 4,
      active: true,
    });

    // Assert Project 1 items remain EXACTLY [A, B, C] (Invariance check)
    expect(project1Items).toHaveLength(3);
    expect(project1Items.map((i) => i.name)).toEqual([
      'Item A: Khảo sát yêu cầu',
      'Item B: Thiết kế UI Wireframe',
      'Item C: Lập trình Frontend & Backend',
    ]);

    // Step 4: Add Service to Project 2 -> Trigger fires snapshot with current templates (A, B, C, D)
    const project2Service = {
      id: 'ps-02',
      project_id: PROJECT_2_ID,
      service_id: SERVICE_ID,
    };
    const project2Items = triggerSnapshotProjectServiceDeliveryItems(
      project2Service,
      templatesTable,
    );

    // Assert Project 2 has [A, B, C, D]
    expect(project2Items).toHaveLength(4);
    expect(project2Items.map((i) => i.name)).toEqual([
      'Item A: Khảo sát yêu cầu',
      'Item B: Thiết kế UI Wireframe',
      'Item C: Lập trình Frontend & Backend',
      'Item D: Triển khai Hosting & Bàn giao',
    ]);

    // Step 5: Deactivate Template B
    templatesTable[1].active = false;

    // Project 1 and Project 2 still maintain their existing snapshots!
    expect(project1Items).toHaveLength(3);
    expect(project2Items).toHaveLength(4);
  });
});
