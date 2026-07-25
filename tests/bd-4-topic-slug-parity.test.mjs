/**
 * BD-4 AC8 — Hermes↔Convex slugFromKeyword parity.
 *
 * Situation: TWO implementations (cannot share a runtime module across Convex isolate
 * and Hermes Node). Shared case SSOT:
 *   ../cns-dashboard/convex/lib/topic-slug-parity-cases.json
 *
 * Proof: Hermes matches the SSOT cases AND Convex vitest suite
 * (tests/convex/topic-slug.test.ts) matches the same SSOT — both must pass.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { slugFromKeyword as hermesSlug } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

const execFileAsync = promisify(execFile);
const testDir = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = process.env.CNS_DASHBOARD_ROOT ?? join(testDir, '../../cns-dashboard');
const casesPath = join(dashboardRoot, 'convex/lib/topic-slug-parity-cases.json');

describe('BD-4 Hermes↔Convex topicSlug parity', () => {
	it('Hermes slugFromKeyword matches shared SSOT cases', () => {
		const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
		assert.ok(cases.length >= 8);
		for (const { keyword, expected } of cases) {
			assert.equal(hermesSlug(keyword), expected, keyword);
		}
	});

	it('Convex slugFromKeyword suite passes against the same SSOT', async () => {
		const { stdout, stderr } = await execFileAsync(
			'npx',
			['vitest', 'run', 'tests/convex/topic-slug.test.ts'],
			{
				cwd: dashboardRoot,
				env: { ...process.env },
				maxBuffer: 4 * 1024 * 1024,
			},
		);
		const out = `${stdout}\n${stderr}`;
		assert.match(out, /Tests\s+\d+\s+passed/);
	});
});
