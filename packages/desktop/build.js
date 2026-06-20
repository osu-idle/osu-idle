/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const { execSync } = require('child_process');
const { join } = require('path');

const packagePath = join(__dirname, 'package.json');
const pkg = require(packagePath);

const original = pkg.version;
const parts = pkg.version.split('.');

pkg.version = `${parts[0]}.${parts[1]}.${parts[2]}${parts[3] ? `-build${parts[3].padStart(4, '0')}` : ''}`;

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

try {
	fs.rmSync(join(__dirname, 'out'), { recursive: true, force: true });
	execSync('npm run build', { stdio: 'inherit' });
	execSync('npm run dist:linuxwin', { stdio: 'inherit' });
} catch(e) {
	console.error("Build failed:", e.message);
} finally {
	pkg.version = original;
	fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
}