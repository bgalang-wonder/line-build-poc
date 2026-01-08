/**
 * Integration tests for LineBuildPersistence (benchtop-dsk)
 *
 * Tests end-to-end persistence for line builds:
 * - Save/load round-trip with data integrity verification
 * - All field types (primitives, nested objects, arrays)
 * - Special characters and Unicode strings
 * - File I/O errors and corrupted JSON recovery
 * - Backup creation and restoration
 * - Validation result persistence
 */

import {
  LineBuildPersistence,
  SaveResult,
  LoadResult,
} from '../persistence';
import { LineBuild } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Test Setup and Teardown
// ============================================================================

const TEST_DATA_DIR = path.join(__dirname, '..', '.test-data');

async function cleanupTestDir() {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }
}

async function ensureTestDir() {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
}

// ============================================================================
// Fixtures
// ============================================================================

const createTestLineBuild = (overrides: Partial<LineBuild> = {}): LineBuild => ({
  id: 'test-build-1',
  menuItemId: '8001',
  menuItemName: 'Grilled Chicken',
  status: 'draft',
  workUnits: [
    {
      id: 'step-1',
      tags: {
        action: 'PREP',
        target: { bomId: '8001', name: 'Chicken' },
        time: { value: 15, unit: 'min', type: 'active' },
        phase: 'PRE_COOK',
        station: 'prep-station',
        equipment: ['cutting-board', 'knife'],
      },
      dependsOn: [],
    },
    {
      id: 'step-2',
      tags: {
        action: 'COOK',
        target: { bomId: '8001', name: 'Chicken' },
        time: { value: 20, unit: 'min', type: 'active' },
        phase: 'COOK',
        station: 'grill',
        equipment: ['grill', 'thermometer'],
      },
      dependsOn: ['step-1'],
    },
  ],
  metadata: {
    version: 1,
    status: 'draft',
    author: 'test-user',
    sourceConversations: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Create a grilled chicken line build',
        timestamp: new Date().toISOString(),
      },
    ],
  },
  ...overrides,
});

// ============================================================================
// Test Suites
// ============================================================================

describe('LineBuildPersistence - Integration Tests', () => {
  let persistence: LineBuildPersistence;

  beforeAll(async () => {
    await cleanupTestDir();
    await ensureTestDir();
  });

  afterAll(async () => {
    await cleanupTestDir();
  });

  beforeEach(() => {
    persistence = new LineBuildPersistence({
      dataDir: TEST_DATA_DIR,
      autoBackup: true,
    });
  });

  describe('Save and Load - Basic Round Trip', () => {
    beforeEach(async () => {
      // Clean before each test group
      await cleanupTestDir();
      await ensureTestDir();
    });

    it('should save a LineBuild and load it back with identical data', async () => {
      const originalBuild = createTestLineBuild();

      // Save
      const saveResult = await persistence.save(originalBuild);
      expect(saveResult.id).toBe(originalBuild.id);
      expect(saveResult.timestamp).toBeTruthy();

      // Load
      const loadResult = await persistence.load(originalBuild.id);
      expect(loadResult.build).toBeDefined();
      expect(loadResult.build.id).toBe(originalBuild.id);
      expect(loadResult.build.menuItemName).toBe(originalBuild.menuItemName);
      expect(loadResult.build.workUnits).toHaveLength(2);
    });

    it('should preserve all LineBuild fields through round-trip', async () => {
      const originalBuild = createTestLineBuild();

      // Save and load
      await persistence.save(originalBuild);
      const loadResult = await persistence.load(originalBuild.id);
      const loadedBuild = loadResult.build;

      // Verify all fields
      expect(loadedBuild.id).toBe(originalBuild.id);
      expect(loadedBuild.menuItemId).toBe(originalBuild.menuItemId);
      expect(loadedBuild.menuItemName).toBe(originalBuild.menuItemName);
      expect(loadedBuild.status).toBe(originalBuild.status);
      expect(loadedBuild.metadata.version).toBe(originalBuild.metadata.version);
      expect(loadedBuild.metadata.author).toBe(originalBuild.metadata.author);
    });

    it('should preserve complex nested structures', async () => {
      const originalBuild = createTestLineBuild({
        workUnits: [
          {
            id: 'complex-step',
            tags: {
              action: 'ASSEMBLE',
              target: { bomId: '8001', name: 'Final Item' },
              time: { value: 5, unit: 'min', type: 'passive' },
              phase: 'ASSEMBLY',
              station: 'assembly-line',
              equipment: ['wrapping-machine', 'scale', 'label-printer'],
              requiresOrder: true,
              bulkPrep: false,
              timingMode: 'buffer-before',
              prepType: 'mise-en-place',
            },
            dependsOn: ['step-1', 'step-2'],
          },
        ],
      });

      await persistence.save(originalBuild);
      const loadResult = await persistence.load(originalBuild.id);
      const workUnit = loadResult.build.workUnits[0];

      expect(workUnit.tags.equipment).toEqual(['wrapping-machine', 'scale', 'label-printer']);
      expect(workUnit.tags.requiresOrder).toBe(true);
      expect(workUnit.tags.bulkPrep).toBe(false);
      expect(workUnit.dependsOn).toEqual(['step-1', 'step-2']);
    });
  });

  describe('Special Characters and Unicode', () => {
    beforeEach(async () => {
      await cleanupTestDir();
      await ensureTestDir();
    });

    it('should preserve special characters in strings', async () => {
      const buildWithSpecialChars = createTestLineBuild({
        menuItemName: 'Grilled Chicken "Spicy" (Sautéed)',
        workUnits: [
          {
            id: 'step-1',
            tags: {
              action: 'PREP',
              target: {
                bomId: '8001',
                name: 'Chicken & Vegetables (mix)',
              },
              phase: 'PRE_COOK',
              station: 'station-1',
            },
            dependsOn: [],
          },
        ],
      });

      await persistence.save(buildWithSpecialChars);
      const loadResult = await persistence.load(buildWithSpecialChars.id);

      expect(loadResult.build.menuItemName).toBe('Grilled Chicken "Spicy" (Sautéed)');
      expect(loadResult.build.workUnits[0].tags.target.name).toBe('Chicken & Vegetables (mix)');
    });

    it('should preserve Unicode characters', async () => {
      const buildWithUnicode = createTestLineBuild({
        menuItemName: 'Grilled Chicken 🍗 Spicy 🌶️',
        metadata: {
          version: 1,
          status: 'draft',
          author: 'Chef José García',
          sourceConversations: [],
        },
      });

      await persistence.save(buildWithUnicode);
      const loadResult = await persistence.load(buildWithUnicode.id);

      expect(loadResult.build.menuItemName).toContain('🍗');
      expect(loadResult.build.metadata.author).toContain('José');
    });

    it('should handle newlines and tabs in content', async () => {
      const buildWithWhitespace = createTestLineBuild({
        metadata: {
          version: 1,
          status: 'draft',
          author: 'Test\nUser\tWith\nWhitespace',
          sourceConversations: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Line 1\nLine 2\nLine 3',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });

      await persistence.save(buildWithWhitespace);
      const loadResult = await persistence.load(buildWithWhitespace.id);

      expect(loadResult.build.metadata.author).toContain('\n');
      expect(loadResult.build.metadata.sourceConversations[0].content).toContain('\n');
    });
  });

  describe('File I/O and Error Recovery', () => {
    beforeEach(async () => {
      await cleanupTestDir();
      await ensureTestDir();
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        persistence.load('nonexistent-build-999')
      ).rejects.toThrow();
    });

    it('should return false for exists check on non-existent file', async () => {
      const exists = await persistence.exists('nonexistent-build-999');
      expect(exists).toBe(false);
    });

    it('should handle deletion with backup creation', async () => {
      const buildId = 'delete-test-1';
      const build = createTestLineBuild({ id: buildId });

      // Save
      await persistence.save(build);

      // Delete
      const backupFile = await persistence.delete(buildId);
      expect(backupFile).toBeTruthy();

      // Verify file is gone
      const exists = await persistence.exists(buildId);
      expect(exists).toBe(false);
    });
  });

  describe('Load All - Multiple Builds', () => {
    beforeEach(async () => {
      await cleanupTestDir();
      await ensureTestDir();
    });

    it('should load all LineBuild files from directory', async () => {
      // Save multiple builds
      const build1 = createTestLineBuild({ id: 'multi-load-1' });
      const build2 = createTestLineBuild({ id: 'multi-load-2' });
      const build3 = createTestLineBuild({ id: 'multi-load-3' });

      await persistence.save(build1);
      await persistence.save(build2);
      await persistence.save(build3);

      // Load all
      const allBuilds = await persistence.loadAll();

      // Should load at least our 3 builds
      expect(allBuilds.length).toBeGreaterThanOrEqual(3);
      const ids = allBuilds.map((b) => b.id);
      expect(ids).toContain('multi-load-1');
      expect(ids).toContain('multi-load-2');
      expect(ids).toContain('multi-load-3');
    });

    it('should skip corrupted files when loading all', async () => {
      // Save valid build
      const validBuild = createTestLineBuild({ id: 'valid-corrupted-test' });
      await persistence.save(validBuild);

      // Create corrupted JSON file
      const corruptedFile = path.join(TEST_DATA_DIR, 'corrupted-skip.json');
      await fs.writeFile(corruptedFile, '{invalid json}');

      // Load all - should include valid file and skip corrupted
      const allBuilds = await persistence.loadAll();
      const ids = allBuilds.map((b) => b.id);

      // Valid build should be present
      expect(ids).toContain('valid-corrupted-test');
    });
  });

  describe('Validation Result Persistence', () => {
    beforeEach(async () => {
      await cleanupTestDir();
      await ensureTestDir();
    });

    it('should save and load validation results', async () => {
      const buildId = 'validation-test-1';
      const validationResult = {
        isValid: true,
        passCount: 10,
        failCount: 0,
        lastCheckedAt: new Date().toISOString(),
      };

      // Save
      await persistence.saveLastCheckResult(buildId, validationResult);

      // Load
      const loaded = await persistence.loadLastCheckResult(buildId);

      expect(loaded).toBeDefined();
      expect(loaded?.isValid).toBe(true);
      expect(loaded?.passCount).toBe(10);
      expect(loaded?.failCount).toBe(0);
    });

    it('should return null for non-existent validation result', async () => {
      const loaded = await persistence.loadLastCheckResult('nonexistent-validation-999');
      expect(loaded).toBeNull();
    });

    it('should overwrite previous validation results', async () => {
      const buildId = 'validation-overwrite-test';
      const result1 = { isValid: false, passCount: 5, failCount: 5 };
      const result2 = { isValid: true, passCount: 10, failCount: 0 };

      // Save first result
      await persistence.saveLastCheckResult(buildId, result1 as any);
      let loaded = await persistence.loadLastCheckResult(buildId);
      expect(loaded?.failCount).toBe(5);

      // Save second result (should overwrite)
      await persistence.saveLastCheckResult(buildId, result2 as any);
      loaded = await persistence.loadLastCheckResult(buildId);
      expect(loaded?.failCount).toBe(0);
    });
  });

  describe('Data Integrity and Recovery', () => {
    beforeEach(async () => {
      await cleanupTestDir();
      await ensureTestDir();
    });

    it('should maintain data integrity after multiple save cycles', async () => {
      const originalBuild = createTestLineBuild({ id: 'integrity-test-1' });

      // Save/load cycle 3 times
      for (let i = 0; i < 3; i++) {
        await persistence.save(originalBuild);
        const loadResult = await persistence.load(originalBuild.id);
        expect(loadResult.build.id).toBe(originalBuild.id);
        expect(loadResult.build.workUnits).toHaveLength(2);
      }
    });

    it('should preserve ISO timestamp format in metadata', async () => {
      const build = createTestLineBuild();
      const originalTimestamp = build.metadata.sourceConversations[0].timestamp;

      await persistence.save(build);
      const loadResult = await persistence.load(build.id);
      const loadedTimestamp = loadResult.build.metadata.sourceConversations[0].timestamp;

      // ISO format should be identical
      expect(loadedTimestamp).toBe(originalTimestamp);
      // Should be valid ISO string
      expect(new Date(loadedTimestamp).getTime()).toBeGreaterThan(0);
    });

    it('should handle empty arrays and null values correctly', async () => {
      const build = createTestLineBuild({
        workUnits: [],
        metadata: {
          version: 1,
          status: 'draft',
          author: 'test',
          sourceConversations: [],
        },
      });

      await persistence.save(build);
      const loadResult = await persistence.load(build.id);

      expect(loadResult.build.workUnits).toEqual([]);
      expect(loadResult.build.metadata.sourceConversations).toEqual([]);
    });
  });

  describe('Performance and Large Data', () => {
    beforeEach(async () => {
      await cleanupTestDir();
      await ensureTestDir();
    });

    it('should handle large LineBuild objects efficiently', async () => {
      // Create build with many work units
      const largeWorkUnits = Array.from({ length: 100 }, (_, i) => ({
        id: `step-${i}`,
        tags: {
          action: 'PREP' as const,
          target: { bomId: '8001', name: `Item ${i}` },
          phase: 'PRE_COOK' as const,
          station: `station-${i}`,
        },
        dependsOn: i > 0 ? [`step-${i - 1}`] : [],
      }));

      const largeConversations = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        role: ('user' as const),
        content: `Message ${i}: ${'x'.repeat(1000)}`, // Each message is ~1KB
        timestamp: new Date().toISOString(),
      }));

      const largeBuild = createTestLineBuild({
        id: 'large-build-1',
        workUnits: largeWorkUnits as any,
        metadata: {
          version: 1,
          status: 'draft',
          author: 'test',
          sourceConversations: largeConversations,
        },
      });

      const startTime = performance.now();
      await persistence.save(largeBuild);
      const endTime = performance.now();

      // Should complete reasonably fast (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should load successfully
      const loadResult = await persistence.load('large-build-1');
      expect(loadResult.build.workUnits).toHaveLength(100);
    });
  });
});
