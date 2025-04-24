import { promises as fs } from 'fs';
import path from 'path';
import {
  AUTO_REGISTRY_DIR,
  AUTO_REGISTRY_DIR_NAME,
  REGISTRY_DIR,
  Styles,
} from '../constants';

async function buildComponents() {
  // 1. Delete the __registry__ folder
  // await fs.rm(AUTO_REGISTRY_DIR, { recursive: true, force: true });

  // 2. Process each folder under /registry
  const entries = await fs.readdir(REGISTRY_DIR, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((ent) => ent.isDirectory())
      .map((ent) => processRegistryFolder(path.join(REGISTRY_DIR, ent.name))),
  );
}

async function processRegistryFolder(dir: string) {
  const itemJsonPath = path.join(dir, 'registry-item.json');
  try {
    // We are on a component
    await fs.access(itemJsonPath);
  } catch {
    // Otherwise we go down one level
    const subs = await fs.readdir(dir, { withFileTypes: true });
    await Promise.all(
      subs
        .filter((sub) => sub.isDirectory())
        .map((sub) => processRegistryFolder(path.join(dir, sub.name))),
    );
    return;
  }

  // Read the JSON
  const raw = await fs.readFile(itemJsonPath, 'utf-8');
  const item = JSON.parse(raw) as any;
  const styles = item.meta?.styles as
    | Record<string, Record<string, string>>
    | undefined;

  // Component template
  const compTplRel = item.files[0].path as string;
  const compTplAbs = path.join(process.cwd(), compTplRel);
  const variants = Object.entries(Styles).map(([_, style]) =>
    styles?.[style] ? [style, styles[style]] : [style, styles?.default ?? {}],
  ) as [string, Record<string, string>][];

  for (const [variant, styleObj] of variants) {
    // Generate the component
    const relDir = path.relative(REGISTRY_DIR, dir);

    const relCompOut = path.posix.join(AUTO_REGISTRY_DIR_NAME, relDir, variant);
    await fs.mkdir(path.join(process.cwd(), relCompOut), { recursive: true });
    let compContent = await fs.readFile(compTplAbs, 'utf-8');

    // 1) Replace the placeholders {{styles.xxx}}
    for (const [key, classes] of Object.entries(styleObj)) {
      const re = new RegExp(`{{styles\\.${key}}}`, 'g');
      compContent = compContent.replace(re, classes);
    }

    // 2) Update the imports and add "/[variant]" :
    //    '@/registry/foo/bar'  →  '@/AUTO_REGISTRY_DIR_NAME/foo/bar/[variant]'
    compContent = compContent.replace(
      /@\/registry\/([^'";\n\r ]+)/g,
      `@/${AUTO_REGISTRY_DIR_NAME}/$1/${variant}`,
    );
    await fs.writeFile(
      path.join(process.cwd(), relCompOut, 'index.tsx'),
      compContent,
    );

    try {
      const demoTplRel = compTplRel.replace(/^registry\//, 'registry/demo/');
      await fs.access(demoTplRel);
      let demoContent = await fs.readFile(demoTplRel, 'utf-8');
      for (const [key, classes] of Object.entries(styleObj)) {
        const re = new RegExp(`{{styles\\.${key}}}`, 'g');
        demoContent = demoContent.replace(re, classes);
      }
      demoContent = demoContent.replace(
        /@\/registry\/([^'";\n\r ]+)/g,
        `@/${AUTO_REGISTRY_DIR_NAME}/$1/${variant}`,
      );
      const relDemoOut = path.posix.join(
        AUTO_REGISTRY_DIR_NAME,
        'demo',
        relDir,
        variant,
      );
      await fs.mkdir(path.join(process.cwd(), relDemoOut), { recursive: true });
      await fs.writeFile(
        path.join(process.cwd(), relDemoOut, 'index.tsx'),
        demoContent,
      );
    } catch {}
  }
}

buildComponents().catch((err) => {
  console.error(err);
  process.exit(1);
});
