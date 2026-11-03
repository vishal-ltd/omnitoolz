import { existsSync, readFileSync, writeFileSync } from "node:fs";

// eslint-config-next@15 uses a default import that minimatch 11 removed.
// Keep the patched dependency reproducible while retaining minimatch's fixed
// release instead of downgrading to the vulnerable 3.x dependency.
const file = "node_modules/@eslint/eslintrc/lib/config-array/override-tester.js";
if (existsSync(file)) {
  const source = readFileSync(file, "utf8");
  const patched = source.replace(
    'import minimatch from "minimatch";\n\nconst { Minimatch } = minimatch;',
    'import { Minimatch } from "minimatch";',
  );
  if (patched !== source) writeFileSync(file, patched);
}
