import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const root = process.cwd();
const require = createRequire(import.meta.url);
const ts = require('typescript');
const Module = require('node:module');
const sourcePath = path.join(root, 'src/api/labelTemplatesApi.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiledSource = ts.transpileModule(source, {
  fileName: sourcePath,
  reportDiagnostics: true,
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    allowImportingTsExtensions: true
  }
});
const compileErrors = (compiledSource.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(compileErrors.length, 0, 'Label API must transpile without diagnostics');

// The exported geometry helpers are pure. Stub only the Supabase client import so this test
// can exercise them without network access, environment variables, or a deployed database.
const originalLoad = Module._load;
const testModule = new Module(sourcePath);
testModule.filename = sourcePath;
testModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
Module._load = function(request, parent, isMain) {
  if (request === '../lib/supabase.ts') return { supabase: null };
  return originalLoad.call(this, request, parent, isMain);
};
try {
  testModule._compile(compiledSource.outputText, sourcePath);
} finally {
  Module._load = originalLoad;
}

const { getDefaultElements, getLabelElementGeometryErrors, assertValidLabelDimensions } = testModule.exports;
const validSizes = [
  [100, 50], [100, 80], [100, 100], [40, 25], [60, 30],
  [150, 80], [30, 20], [1, 1], [240, 300]
];
let generatedElementCount = 0;
for (const [width, height] of validSizes) {
  const elements = getDefaultElements({ width, height });
  assert.ok(elements.length > 0, `Expected default elements for ${width}x${height}`);
  const errors = getLabelElementGeometryErrors(elements, width, height);
  assert.deepEqual(errors, [], `${width}x${height} layout must stay inside canvas`);
  generatedElementCount += elements.length;
}

const invalidSizes = [[0, 50], [100, 0], [1.5, 50], [Infinity, 10], [-10, 20]];
for (const [width, height] of invalidSizes) {
  assert.throws(() => assertValidLabelDimensions(width, height), /TEMPLATE_VALIDATION_ERROR/);
  assert.throws(() => getDefaultElements({ width, height }), /TEMPLATE_VALIDATION_ERROR/);
}

const deliberatelyInvalid = [{ id: 'outside', name: 'Outside', type: 'text', x: 99, y: 0, width: 2, height: 5, visible: true }];
assert.ok(getLabelElementGeometryErrors(deliberatelyInvalid, 100, 50).length > 0,
  'Geometry guard must reject an element that extends beyond the label');

console.log(JSON.stringify({
  status: 'PASS',
  validSizesTested: validSizes.length,
  generatedElementsChecked: generatedElementCount,
  invalidSizesRejected: invalidSizes.length,
  outOfBoundsElementRejected: true
}, null, 2));
