/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const { execSync } = require('child_process');
const { join } = require('path');

const packagePath = join(__dirname, 'package.json');
const pkg = require(packagePath);

const original = pkg.version;
const parts = pkg.version.split('.');

pkg.version = 
	`${parts[0]}.${parts[1]}.${parts[2]}${parts[3] ? `-build${parts[3].padStart(4, '0')}` : ''}`
;

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

// The staged deploy (scripts/staged-build.mjs) builds the renderer into
// `dist.next` and only swaps it live if everything - including this installer -
// compiles. Point extraResources at that staged tree instead of the live dist.
const ebPath = join(__dirname, 'electron-builder.yml');
const rendererDist = process.env.RENDERER_DIST;
const ebOriginal = rendererDist ? fs.readFileSync(ebPath, 'utf8') : null;
if (rendererDist) {
	fs.writeFileSync(ebPath, ebOriginal
		.replaceAll('../client/dist', `../client/${rendererDist}`)
		.replaceAll('../web/dist', `../web/${rendererDist}`));
}

let failed = false;
try {
	// Clear prior outputs so a failed build can't leave stale installers for
	// publish-desktop to pick up.
	fs.rmSync(join(__dirname, 'out'), {
		recursive: true, force: true, 
	});
	fs.rmSync(join(__dirname, 'release'), {
		recursive: true, force: true, 
	});
	execSync('npm run build', { stdio: 'inherit' });
	execSync('npm run dist:linuxwin', { stdio: 'inherit' });
} catch(e) {
	console.error('Build failed:', e.message);
	failed = true;
} finally {
	pkg.version = original;
	fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
	if (rendererDist) fs.writeFileSync(ebPath, ebOriginal);
}

// Propagate the failure so the deploy gate aborts instead of publishing nothing
// (or a stale build).
if (failed) process.exit(1);