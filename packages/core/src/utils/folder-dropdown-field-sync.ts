import type { CustomField, DropdownField } from '../clickup-client/custom-fields-enhanced.js';

export interface DropdownOptionInput {
  name: string;
  color?: string;
}

export interface FolderDropdownFieldClient {
  getFolderCustomFields(folderId: string): Promise<CustomField[]>;
  createFolderDropdownFieldExperimental(
    folderId: string,
    params: {
      name: string;
      required: boolean;
      options: DropdownOptionInput[];
    }
  ): Promise<CustomField>;
}

export const PROJECT_STAGE_OPTIONS: readonly DropdownOptionInput[] = [
  { name: 'Backlog', color: '#b6b6ff' },
  { name: 'Definição da especificação', color: '#edadc8' },
  { name: 'Planejamento', color: '#cecece' },
  { name: 'Pronto para execução', color: '#aec0f5' },
  { name: 'Em implementação', color: '#96c7f2' },
  { name: 'Em revisão', color: '#92ceac' },
  { name: 'Aguardando validação', color: '#646464' },
  { name: 'Aguardando aprovação', color: '#8d8d8d' },
  { name: 'Aguardando terceiros', color: '#6647f0' },
  { name: 'Bloqueado', color: '#3e63dd' },
  { name: 'Em implantação', color: '#0091ff' },
  { name: 'Entregue', color: '#30a46c' },
  { name: 'Cancelado', color: '#e9c162' },
];

export type FolderDropdownSyncStatus =
  | 'unchanged'
  | 'planned_create'
  | 'confirmation_required'
  | 'created'
  | 'manual_update_required'
  | 'conflict'
  | 'verification_required';

export interface FolderDropdownSyncResult {
  ok: boolean;
  status: FolderDropdownSyncStatus;
  folder_id: string;
  field_name: string;
  field_id?: string;
  field_type?: string;
  desired_options: string[];
  existing_options: string[];
  missing_options: string[];
  unexpected_options: string[];
  order_matches: boolean;
  write_performed: boolean;
  endpoint_support: 'experimental_undocumented';
  message: string;
  reconciled_after_error?: boolean;
}

export interface SyncFolderDropdownFieldParams {
  folderId: string;
  fieldName?: string;
  options?: readonly DropdownOptionInput[];
  required?: boolean;
  dryRun?: boolean;
  confirmCreate?: boolean;
}

interface SyncPlan {
  status: 'unchanged' | 'create' | 'manual_update_required' | 'conflict';
  field?: CustomField;
  existingOptions: string[];
  desiredOptions: string[];
  missingOptions: string[];
  unexpectedOptions: string[];
  orderMatches: boolean;
  message: string;
}

function normalizedName(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('pt-BR');
}

function optionNames(field: CustomField): string[] {
  if (field.type !== 'drop_down') {
    return [];
  }

  return [...(field as DropdownField).type_config.options]
    .sort((left, right) => left.orderindex - right.orderindex)
    .map(option => option.name.trim());
}

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateDesiredOptions(options: readonly DropdownOptionInput[]): DropdownOptionInput[] {
  if (options.length === 0) {
    throw new Error('At least one dropdown option is required');
  }

  const normalized = new Set<string>();
  return options.map(option => {
    const name = option.name.trim();
    if (!name) {
      throw new Error('Dropdown option names cannot be empty');
    }

    const key = normalizedName(name);
    if (normalized.has(key)) {
      throw new Error(`Duplicate dropdown option: ${name}`);
    }
    normalized.add(key);

    return option.color ? { name, color: option.color } : { name };
  });
}

function buildPlan(
  fields: CustomField[],
  fieldName: string,
  desired: DropdownOptionInput[]
): SyncPlan {
  const matches = fields.filter(field => normalizedName(field.name) === normalizedName(fieldName));
  const desiredOptions = desired.map(option => option.name);

  if (matches.length > 1) {
    return {
      status: 'conflict',
      existingOptions: [],
      desiredOptions,
      missingOptions: desiredOptions,
      unexpectedOptions: [],
      orderMatches: false,
      message:
        `Found ${matches.length} fields named "${fieldName}" in the folder; ` +
        'resolve duplicates in ClickUp before syncing.',
    };
  }

  if (matches.length === 0) {
    return {
      status: 'create',
      existingOptions: [],
      desiredOptions,
      missingOptions: desiredOptions,
      unexpectedOptions: [],
      orderMatches: false,
      message: `Field "${fieldName}" does not exist and can be created.`,
    };
  }

  const field = matches[0];
  if (field.type !== 'drop_down') {
    return {
      status: 'conflict',
      field,
      existingOptions: [],
      desiredOptions,
      missingOptions: desiredOptions,
      unexpectedOptions: [],
      orderMatches: false,
      message: `Field "${fieldName}" exists with type "${field.type}" instead of "drop_down".`,
    };
  }

  const existingOptions = optionNames(field);
  const desiredKeys = new Set(desiredOptions.map(normalizedName));
  const existingKeys = new Set(existingOptions.map(normalizedName));
  const missingOptions = desiredOptions.filter(option => !existingKeys.has(normalizedName(option)));
  const unexpectedOptions = existingOptions.filter(
    option => !desiredKeys.has(normalizedName(option))
  );
  const orderMatches = sameOrder(existingOptions, desiredOptions);

  if (missingOptions.length === 0 && unexpectedOptions.length === 0 && orderMatches) {
    return {
      status: 'unchanged',
      field,
      existingOptions,
      desiredOptions,
      missingOptions,
      unexpectedOptions,
      orderMatches,
      message: `Field "${fieldName}" already matches the desired definition.`,
    };
  }

  return {
    status: 'manual_update_required',
    field,
    existingOptions,
    desiredOptions,
    missingOptions,
    unexpectedOptions,
    orderMatches,
    message:
      `Field "${fieldName}" exists but its options differ. ` +
      'The ClickUp API does not expose a supported field-definition update operation; update it in the ClickUp UI.',
  };
}

function resultFromPlan(
  plan: SyncPlan,
  folderId: string,
  fieldName: string,
  overrides: Partial<FolderDropdownSyncResult> = {}
): FolderDropdownSyncResult {
  const ok = plan.status === 'unchanged';
  return {
    ok,
    status: plan.status === 'create' ? 'planned_create' : plan.status,
    folder_id: folderId,
    field_name: fieldName,
    field_id: plan.field?.id,
    field_type: plan.field?.type,
    desired_options: plan.desiredOptions,
    existing_options: plan.existingOptions,
    missing_options: plan.missingOptions,
    unexpected_options: plan.unexpectedOptions,
    order_matches: plan.orderMatches,
    write_performed: false,
    endpoint_support: 'experimental_undocumented',
    message: plan.message,
    ...overrides,
  };
}

export async function syncFolderDropdownField(
  client: FolderDropdownFieldClient,
  params: SyncFolderDropdownFieldParams
): Promise<FolderDropdownSyncResult> {
  const folderId = params.folderId.trim();
  const fieldName = (params.fieldName ?? 'Etapa').trim();
  const desired = validateDesiredOptions(params.options ?? PROJECT_STAGE_OPTIONS);
  const dryRun = params.dryRun ?? true;

  if (!folderId) {
    throw new Error('folderId is required');
  }
  if (!fieldName) {
    throw new Error('fieldName is required');
  }

  const initialFields = await client.getFolderCustomFields(folderId);
  const initialPlan = buildPlan(initialFields, fieldName, desired);

  if (initialPlan.status !== 'create') {
    return resultFromPlan(initialPlan, folderId, fieldName);
  }

  if (dryRun) {
    return resultFromPlan(initialPlan, folderId, fieldName, {
      ok: true,
      status: 'planned_create',
      message: `${initialPlan.message} Dry-run only: no request was sent to the experimental creation endpoint.`,
    });
  }

  if (!params.confirmCreate) {
    return resultFromPlan(initialPlan, folderId, fieldName, {
      ok: false,
      status: 'confirmation_required',
      message:
        'Creation requires confirm_create=true because ClickUp does not document folder-level custom-field creation.',
    });
  }

  let createdField: CustomField | undefined;
  try {
    createdField = await client.createFolderDropdownFieldExperimental(folderId, {
      name: fieldName,
      required: params.required ?? false,
      options: desired,
    });
  } catch (error) {
    const reconciledFields = await client.getFolderCustomFields(folderId);
    const reconciledPlan = buildPlan(reconciledFields, fieldName, desired);
    if (reconciledPlan.status === 'unchanged') {
      return resultFromPlan(reconciledPlan, folderId, fieldName, {
        ok: true,
        status: 'created',
        write_performed: true,
        reconciled_after_error: true,
        message:
          'The create request returned an error, but a follow-up read confirmed the desired field. Do not retry.',
      });
    }

    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Folder custom-field creation failed and could not be reconciled: ${detail}. ` +
        'Inspect the folder in ClickUp before retrying.'
    );
  }

  const verifiedFields = await client.getFolderCustomFields(folderId);
  const verifiedPlan = buildPlan(verifiedFields, fieldName, desired);
  if (verifiedPlan.status === 'unchanged') {
    return resultFromPlan(verifiedPlan, folderId, fieldName, {
      ok: true,
      status: 'created',
      write_performed: true,
      message: `Field "${fieldName}" was created and verified on folder ${folderId}.`,
    });
  }

  return resultFromPlan(verifiedPlan, folderId, fieldName, {
    ok: false,
    status: 'verification_required',
    field_id: verifiedPlan.field?.id ?? createdField?.id,
    write_performed: true,
    message:
      'ClickUp accepted the create request, but the follow-up read did not match the desired ' +
      'definition. Inspect the folder before retrying.',
  });
}
