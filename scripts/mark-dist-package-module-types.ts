import { writeFileSync } from 'fs';

const distDirNameAndPackageFileMappings = {
  'dist/esm': { type: 'module' },
  'dist/cjs': { type: 'commonjs' },
};

for (const [distDirName, packageFileContents] of Object.entries(
  distDirNameAndPackageFileMappings
)) {
  const destPath = `${__dirname}/../${distDirName}/package.json`;
  const output = JSON.stringify(packageFileContents, undefined, 2);
  writeFileSync(destPath, output);
}
