import { ConflictException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ServicesService } from './services.service';

function queryResult(
  result: { data?: unknown; count?: number | null; error?: unknown },
  terminal?: 'maybeSingle' | 'single' | 'range',
) {
  const query: any = {};
  for (const method of [
    'select',
    'eq',
    'or',
    'order',
    'range',
    'insert',
    'update',
    'delete',
    'single',
    'maybeSingle',
  ]) {
    query[method] = jest.fn(() => query);
  }
  if (terminal) {
    query[terminal] = jest.fn().mockResolvedValue({
      data: null,
      error: null,
      ...result,
    });
  }
  query.then = (resolve: any, reject: any) =>
    Promise.resolve({
      data: null,
      error: null,
      ...result,
    }).then(resolve, reject);

  return query;
}

describe('ServicesService', () => {
  let service: ServicesService;
  let client: { from: jest.Mock };

  beforeEach(() => {
    client = { from: jest.fn() };
    service = new ServicesService({
      getSystemClient: () => client,
    } as unknown as SupabaseService);
  });

  describe('Service Categories', () => {
    it('returns categories with formatted attributes and services count', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          service_category_code: 'NHDV_01',
          code: 'WEBSITE_SEO',
          name: 'Website & SEO',
          description: 'Website and SEO services',
          sort_order: 1,
          active: true,
          services: [{ count: 6 }],
          created_at: '2026-08-19T00:00:00Z',
          updated_at: '2026-08-19T00:00:00Z',
        },
      ];

      client.from.mockReturnValueOnce(queryResult({ data: mockCategories }));

      const result = await service.getCategories({ active: true });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'cat-1',
        serviceCategoryCode: 'NHDV_01',
        code: 'WEBSITE_SEO',
        name: 'Website & SEO',
        servicesCount: 6,
        active: true,
      });
    });

    it('creates a service category and maps unique violation to 409', async () => {
      client.from
        .mockReturnValueOnce(queryResult({ data: null }, 'maybeSingle')) // existing code lookup
        .mockReturnValueOnce(
          queryResult(
            {
              data: {
                id: 'cat-2',
                service_category_code: 'NHDV_02',
                code: 'PERFORMANCE',
                name: 'Performance',
              },
            },
            'single',
          ),
        );

      const res = await service.createCategory(
        {
          code: 'PERFORMANCE',
          name: 'Performance',
          sortOrder: 2,
          active: true,
        },
        'admin-1',
      );

      expect(res).toMatchObject({ code: 'PERFORMANCE' });

      // Duplicate code check
      client.from.mockReset();
      client.from.mockReturnValueOnce(
        queryResult({ data: { id: 'cat-2' } }, 'maybeSingle'),
      );

      await expect(
        service.createCategory(
          {
            code: 'PERFORMANCE',
            name: 'Performance Duplicate',
            sortOrder: 2,
            active: true,
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('Services Management', () => {
    it('uses DB-side search, filters, pagination and count', async () => {
      const query = queryResult({ data: [], count: 26, error: null }, 'range');
      client.from.mockReturnValueOnce(query);

      const result = await service.getServices({
        q: 'SEO',
        categoryId: 'cat-1',
        active: true,
        page: 1,
        pageSize: 10,
      });

      expect(query.or).toHaveBeenCalledWith(
        'code.ilike.%SEO%,name.ilike.%SEO%,service_code.ilike.%SEO%',
      );
      expect(query.eq).toHaveBeenCalledWith('service_category_id', 'cat-1');
      expect(query.eq).toHaveBeenCalledWith('active', true);
      expect(query.range).toHaveBeenCalledWith(0, 9);
      expect(result).toMatchObject({ total: 26, totalPages: 3 });
    });

    it('creates a service and links it with category', async () => {
      client.from
        .mockReturnValueOnce(
          queryResult(
            {
              data: {
                id: 'cat-1',
                service_category_code: 'NHDV_01',
                name: 'Web',
              },
            },
            'maybeSingle',
          ),
        ) // getCategoryById
        .mockReturnValueOnce(queryResult({ data: null }, 'maybeSingle')) // code check
        .mockReturnValueOnce(
          queryResult(
            {
              data: {
                id: 'svc-1',
                service_code: 'DV_01',
                name: 'Thiết kế Website',
                service_category_id: 'cat-1',
              },
            },
            'single',
          ),
        );

      const res = await service.createService(
        {
          name: 'Thiết kế Website',
          categoryId: 'cat-1',
          code: 'DV_01_WEB',
          sortOrder: 1,
          active: true,
        },
        'admin-1',
      );

      expect(res).toMatchObject({ name: 'Thiết kế Website' });
    });

    it('returns SERVICE_NOT_FOUND for missing catalog records', async () => {
      client.from.mockReturnValueOnce(
        queryResult({ data: null }, 'maybeSingle'),
      );

      await expect(service.getServiceById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('Service Delivery Items (Standard Templates)', () => {
    it('creates a standard delivery item for a service', async () => {
      client.from
        .mockReturnValueOnce(
          queryResult(
            {
              data: { id: 'svc-1', name: 'Thiết kế Website' },
            },
            'maybeSingle',
          ),
        ) // getServiceById
        .mockReturnValueOnce(
          queryResult(
            {
              data: {
                id: 'item-1',
                delivery_item_code: 'HMDV_01',
                name: 'Khảo sát yêu cầu',
                service_id: 'svc-1',
              },
            },
            'single',
          ),
        );

      const item = await service.createDeliveryItem(
        'svc-1',
        {
          name: 'Khảo sát yêu cầu',
          description: 'Lấy yêu cầu khách hàng',
          sortOrder: 1,
          isRequired: true,
          active: true,
        },
        'admin-1',
      );

      expect(item).toMatchObject({
        name: 'Khảo sát yêu cầu',
        delivery_item_code: 'HMDV_01',
      });
    });

    it('soft deactivates delivery item if already referenced by projects', async () => {
      // count check on project_service_items returns 2 references
      client.from
        .mockReturnValueOnce(
          queryResult({
            count: 2,
            data: null,
          }),
        )
        // updateDeliveryItem selects item
        .mockReturnValueOnce(
          queryResult(
            {
              data: { id: 'item-1', service_id: 'svc-1', active: true },
            },
            'maybeSingle',
          ),
        )
        .mockReturnValueOnce(
          queryResult(
            {
              data: { id: 'item-1', active: false },
            },
            'single',
          ),
        );

      const res = await service.deleteDeliveryItem(
        'svc-1',
        'item-1',
        'admin-1',
      );
      expect(res).toMatchObject({ active: false });
    });
  });
});
