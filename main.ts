import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function replaceProjectTree(name: string): void {
  const source = join(projectRoot, name);
  const destination = join(outputRoot, name);
  // A grader may reuse its output folder. Replace these generated trees so an old screenshot cannot survive a new run.
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}

function stageEntry(): void {
  // The dossier is built from a clean pair of trees, which makes repeated local runs deterministic.
  mkdirSync(outputRoot, { recursive: true });
  replaceProjectTree('app');
  replaceProjectTree('screenshots');
}

function writeEntryDossier(): void {
  const dossierBytes = buildDossier(outputRoot, DOSSIER_CAPS);
  writeFileSync(join(outputRoot, 'dossier.json'), dossierBytes);
}

stageEntry();
writeEntryDossier();
