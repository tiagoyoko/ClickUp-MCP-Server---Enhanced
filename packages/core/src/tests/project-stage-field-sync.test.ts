import type { ClickUpClient } from '../clickup-client';
import {
  EnhancedCustomFieldsClient,
  type CustomField,
  type DropdownField,
} from '../clickup-client/custom-fields-enhanced';
import {
  PROJECT_STAGE_OPTIONS,
  syncFolderDropdownField,
  type FolderDropdownFieldClient,
} from '../utils/folder-dropdown-field-sync';

const FOLDER_ID = '901711729053';

function dropdownField(
  options: string[] = PROJECT_STAGE_OPTIONS.map(option => option.name),
  overrides: Partial<DropdownField> = {}
): DropdownField {
  return {
    id: 'field-etapa',
    name: 'Etapa',
    type: 'drop_down',
    date_created: '1',
    hide_from_guests: false,
    required: false,
    type_config: {
      options: options.map((name, orderindex) => ({
        id: `option-${orderindex}`,
        name,
        orderindex,
      })),
    },
    ...overrides,
  };
}

function fakeClient(fields: CustomField[]): jest.Mocked<FolderDropdownFieldClient> {
  return {
    getFolderCustomFields: jest.fn().mockResolvedValue(fields),
    createFolderDropdownFieldExperimental: jest.fn(),
  };
}

describe('project stage field synchronization', () => {
  it('keeps the canonical 13 stages in their agreed order', () => {
    expect(PROJECT_STAGE_OPTIONS.map(option => option.name)).toEqual([
      'Backlog',
      'Definição da especificação',
      'Planejamento',
      'Pronto para execução',
      'Em implementação',
      'Em revisão',
      'Aguardando validação',
      'Aguardando aprovação',
      'Aguardando terceiros',
      'Bloqueado',
      'Em implantação',
      'Entregue',
      'Cancelado',
    ]);
  });

  it('is idempotent when the field already matches', async () => {
    const client = fakeClient([dropdownField()]);

    const result = await syncFolderDropdownField(client, { folderId: FOLDER_ID });

    expect(result).toMatchObject({
      ok: true,
      status: 'unchanged',
      field_id: 'field-etapa',
      write_performed: false,
      order_matches: true,
      missing_options: [],
      unexpected_options: [],
    });
    expect(client.createFolderDropdownFieldExperimental).not.toHaveBeenCalled();
  });

  it('returns a creation plan without writing during dry-run', async () => {
    const client = fakeClient([]);

    const result = await syncFolderDropdownField(client, { folderId: FOLDER_ID });

    expect(result).toMatchObject({
      ok: true,
      status: 'planned_create',
      write_performed: false,
    });
    expect(result.missing_options).toHaveLength(13);
    expect(client.createFolderDropdownFieldExperimental).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before using the experimental endpoint', async () => {
    const client = fakeClient([]);

    const result = await syncFolderDropdownField(client, {
      folderId: FOLDER_ID,
      dryRun: false,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'confirmation_required',
      write_performed: false,
    });
    expect(client.createFolderDropdownFieldExperimental).not.toHaveBeenCalled();
  });

  it('creates once and verifies the resulting definition', async () => {
    const field = dropdownField();
    const client: jest.Mocked<FolderDropdownFieldClient> = {
      getFolderCustomFields: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([field]),
      createFolderDropdownFieldExperimental: jest.fn().mockResolvedValue(field),
    };

    const result = await syncFolderDropdownField(client, {
      folderId: FOLDER_ID,
      dryRun: false,
      confirmCreate: true,
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      field_id: 'field-etapa',
      write_performed: true,
    });
    expect(client.createFolderDropdownFieldExperimental).toHaveBeenCalledTimes(1);
    expect(client.createFolderDropdownFieldExperimental).toHaveBeenCalledWith(
      FOLDER_ID,
      expect.objectContaining({ name: 'Etapa', required: false })
    );
  });

  it('reconciles an ambiguous create error instead of encouraging a duplicate retry', async () => {
    const field = dropdownField();
    const client: jest.Mocked<FolderDropdownFieldClient> = {
      getFolderCustomFields: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([field]),
      createFolderDropdownFieldExperimental: jest
        .fn()
        .mockRejectedValue(new Error('connection reset')),
    };

    const result = await syncFolderDropdownField(client, {
      folderId: FOLDER_ID,
      dryRun: false,
      confirmCreate: true,
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      reconciled_after_error: true,
      write_performed: true,
    });
  });

  it('reports definition drift without attempting an unsupported update', async () => {
    const client = fakeClient([dropdownField(['Backlog', 'Entregue'])]);

    const result = await syncFolderDropdownField(client, { folderId: FOLDER_ID });

    expect(result).toMatchObject({
      ok: false,
      status: 'manual_update_required',
      existing_options: ['Backlog', 'Entregue'],
      write_performed: false,
    });
    expect(result.missing_options).toContain('Em implementação');
    expect(client.createFolderDropdownFieldExperimental).not.toHaveBeenCalled();
  });

  it('refuses duplicate field definitions instead of choosing one arbitrarily', async () => {
    const client = fakeClient([
      dropdownField(),
      dropdownField(undefined, { id: 'duplicate', name: ' etapa ' }),
    ]);

    const result = await syncFolderDropdownField(client, { folderId: FOLDER_ID });

    expect(result).toMatchObject({ ok: false, status: 'conflict', write_performed: false });
  });
});

describe('folder custom-field client requests', () => {
  it('uses the configured client base URL for folder reads', async () => {
    const field = dropdownField();
    const get = jest.fn().mockResolvedValue({ data: { fields: [field] } });
    const clickUpClient = {
      getAxiosInstance: () => ({ get }),
    } as unknown as ClickUpClient;
    const client = new EnhancedCustomFieldsClient(clickUpClient);

    const result = await client.getFolderCustomFields(FOLDER_ID);

    expect(result).toEqual([field]);
    expect(get).toHaveBeenCalledWith(`/folder/${FOLDER_ID}/field`);
  });

  it('sends dropdown options under type_config in their requested order', async () => {
    const created = dropdownField(['Backlog', 'Entregue']);
    const post = jest.fn().mockResolvedValue({ data: created });
    const clickUpClient = {
      getAxiosInstance: () => ({ post }),
    } as unknown as ClickUpClient;
    const client = new EnhancedCustomFieldsClient(clickUpClient);

    const result = await client.createFolderDropdownFieldExperimental(FOLDER_ID, {
      name: 'Etapa',
      required: false,
      options: [
        { name: 'Backlog', color: '#b6b6ff' },
        { name: 'Entregue', color: '#30a46c' },
      ],
    });

    expect(result).toBe(created);
    expect(post).toHaveBeenCalledWith(`/folder/${FOLDER_ID}/field`, {
      name: 'Etapa',
      type: 'drop_down',
      required: false,
      type_config: {
        sorting: 'manual',
        options: [
          { name: 'Backlog', color: '#b6b6ff', orderindex: 0 },
          { name: 'Entregue', color: '#30a46c', orderindex: 1 },
        ],
      },
    });
  });
});
