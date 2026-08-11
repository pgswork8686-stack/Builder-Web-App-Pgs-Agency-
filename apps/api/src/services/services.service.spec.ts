import { ConflictException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ServicesService } from './services.service';

function queryResult(
  result: { data?: unknown; count?: number | null; error?: unknown },
  terminal: 'maybeSingle' | 'single' | 'range' = 'maybeSingle',
) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'select',
    'eq',
    'or',
    'order',
    'range',
    'insert',
    'update',
    'single',
    'maybeSingle',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query[terminal] = jest.fn().mockResolvedValue({
    data: null,
    error: null,
    ...result,
  });
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

  it('uses DB-side search, filters, pagination and count', async () => {
    const query = queryResult({ data: [], count: 21, error: null }, 'range');
    client.from.mockReturnValueOnce(query);

    const result = await service.getServices({
      q: 'SEO',
      active: true,
      page: 3,
      pageSize: 10,
    });

    expect(query.or).toHaveBeenCalledWith('code.ilike.%SEO%,name.ilike.%SEO%');
    expect(query.eq).toHaveBeenCalledWith('active', true);
    expect(query.range).toHaveBeenCalledWith(20, 29);
    expect(result).toMatchObject({ total: 21, totalPages: 3 });
  });

  it('creates a service and maps a racing unique violation to 409', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: null }))
      .mockReturnValueOnce(
        queryResult(
          {
            data: { id: 'service-id', code: 'SEO' },
            error: null,
          },
          'single',
        ),
      );

    await expect(
      service.createService(
        { code: 'SEO', name: 'SEO', active: true },
        'admin-id',
      ),
    ).resolves.toMatchObject({ code: 'SEO' });

    client.from.mockReset();
    client.from
      .mockReturnValueOnce(queryResult({ data: null }))
      .mockReturnValueOnce(
        queryResult(
          { data: null, error: { code: '23505', message: 'duplicate' } },
          'single',
        ),
      );

    await expect(
      service.createService(
        { code: 'SEO', name: 'SEO', active: true },
        'admin-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns SERVICE_NOT_FOUND for missing catalog records', async () => {
    client.from.mockReturnValueOnce(queryResult({ data: null }));

    await expect(service.getServiceById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the active flag without requiring unrelated fields', async () => {
    client.from
      .mockReturnValueOnce(
        queryResult({ data: { id: 'service-id', active: true } }),
      )
      .mockReturnValueOnce(
        queryResult(
          { data: { id: 'service-id', active: false }, error: null },
          'single',
        ),
      );

    await expect(
      service.updateService('service-id', { active: false }, 'admin-id'),
    ).resolves.toMatchObject({ active: false });
  });
});
