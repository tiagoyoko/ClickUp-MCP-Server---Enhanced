#!/usr/bin/env node
/* eslint-disable no-console */
import 'dotenv/config';
import { ClickUpClient } from '../clickup-client/index.js';
import { createEnhancedCustomFieldsClient } from '../clickup-client/custom-fields-enhanced.js';
import {
  PROJECT_STAGE_OPTIONS,
  syncFolderDropdownField,
  type DropdownOptionInput,
} from '../utils/folder-dropdown-field-sync.js';

interface CliOptions {
  folderId?: string;
  fieldName: string;
  options: DropdownOptionInput[];
  required: boolean;
  dryRun: boolean;
  confirmCreate: boolean;
  json: boolean;
  help: boolean;
}

const HELP = `Usage: clickup-project-stage-sync [options]

Idempotently inspect or create the canonical folder-level "Etapa" dropdown.
Dry-run is the default. Creation uses an undocumented ClickUp endpoint and
requires both --apply and --confirm-create.

Options:
  --folder <id>          Target folder ID (or CLICKUP_PROJECTS_FOLDER_ID)
  --name <name>          Field name (default: Etapa)
  --options-json <json>  Ordered array of names or {"name","color"} objects
  --required             Make a newly created field required
  --dry-run              Inspect only (default)
  --apply                Allow creation when the field is missing
  --confirm-create       Confirm use of the undocumented creation endpoint
  --json                 Emit machine-readable JSON
  --help                 Show this help
`;

function takeValue(argv: string[], index: number, flag: string): [string, number] {
  const inline = argv[index].split('=', 2);
  if (inline.length === 2) {
    return [inline[1], index];
  }

  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return [value, index + 1];
}

function parseOptionsJson(raw: string): DropdownOptionInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('--options-json must be valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('--options-json must be a JSON array');
  }

  return parsed.map((value, index) => {
    if (typeof value === 'string') {
      return { name: value };
    }
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { name?: unknown }).name === 'string' &&
      ((value as { color?: unknown }).color === undefined ||
        typeof (value as { color?: unknown }).color === 'string')
    ) {
      return {
        name: (value as { name: string }).name,
        ...((value as { color?: string }).color
          ? { color: (value as { color: string }).color }
          : {}),
      };
    }
    throw new Error(`--options-json item ${index + 1} must be a name or {name,color}`);
  });
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    folderId: process.env.CLICKUP_PROJECTS_FOLDER_ID,
    fieldName: 'Etapa',
    options: PROJECT_STAGE_OPTIONS.map(option => ({ ...option })),
    required: false,
    dryRun: true,
    confirmCreate: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--help') {
      options.help = true;
    } else if (argument === '--json') {
      options.json = true;
    } else if (argument === '--required') {
      options.required = true;
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--apply') {
      options.dryRun = false;
    } else if (argument === '--confirm-create') {
      options.confirmCreate = true;
    } else if (argument === '--folder' || argument.startsWith('--folder=')) {
      [options.folderId, index] = takeValue(argv, index, '--folder');
    } else if (argument === '--name' || argument.startsWith('--name=')) {
      [options.fieldName, index] = takeValue(argv, index, '--name');
    } else if (argument === '--options-json' || argument.startsWith('--options-json=')) {
      const [raw, consumedIndex] = takeValue(argv, index, '--options-json');
      options.options = parseOptionsJson(raw);
      index = consumedIndex;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return options;
}

function printHuman(result: Awaited<ReturnType<typeof syncFolderDropdownField>>): void {
  console.log(`Status: ${result.status}`);
  console.log(`Folder: ${result.folder_id}`);
  console.log(`Field: ${result.field_name}${result.field_id ? ` (${result.field_id})` : ''}`);
  console.log(`Write performed: ${result.write_performed ? 'yes' : 'no'}`);
  console.log(result.message);

  if (result.missing_options.length > 0) {
    console.log(`Missing options: ${result.missing_options.join(', ')}`);
  }
  if (result.unexpected_options.length > 0) {
    console.log(`Unexpected options: ${result.unexpected_options.join(', ')}`);
  }
}

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(HELP);
    return;
  }

  if (!options.folderId?.trim()) {
    console.error('A folder ID is required through --folder or CLICKUP_PROJECTS_FOLDER_ID.');
    process.exitCode = 2;
    return;
  }

  const apiToken = process.env.CLICKUP_API_TOKEN;
  if (!apiToken) {
    console.error(
      'CLICKUP_API_TOKEN is required. Pass it through the environment, never as an argument.'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const client = createEnhancedCustomFieldsClient(
      new ClickUpClient({
        apiToken,
        ...(process.env.CLICKUP_API_URL ? { baseUrl: process.env.CLICKUP_API_URL } : {}),
      })
    );
    const result = await syncFolderDropdownField(client, {
      folderId: options.folderId,
      fieldName: options.fieldName,
      options: options.options,
      required: options.required,
      dryRun: options.dryRun,
      confirmCreate: options.confirmCreate,
    });

    if (options.json) {
      console.log(JSON.stringify(result));
    } else {
      printHuman(result);
    }
    if (!result.ok) {
      process.exitCode = 2;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ ok: false, status: 'error', message }));
    } else {
      console.error(`Error: ${message}`);
    }
    process.exitCode = 1;
  }
}

void main();
