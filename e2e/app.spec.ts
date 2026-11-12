import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function generateDeck(page: Page) {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('把长文案');
  await page.getByRole('button', { name: '填入示例' }).click();
  await expect(page.locator('textarea')).not.toHaveValue('');
  await page.getByRole('button', { name: /生成我的演示/ }).click();
  await expect(page.locator('.generation-strip')).toBeVisible();
  await expect(page.locator('.stage-kicker.phase-ready')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.thumbnail:not(.skeleton)')).toHaveCount(8);
}

test.describe('织演 full flow', () => {
  test('generates, presents, switches theme and exports a standalone deck', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Chromium-only presentation/fullscreen checks');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await generateDeck(page);
    await expect(page.locator('.stage-kicker')).toHaveText(/PRESENTATION READY/);
    await expect(page.locator('.generation-strip')).toHaveCount(0);
    await expect(page.locator('.stage-title-wrap h2')).toHaveText('把复杂，讲得动人');
    await expect(page.locator('.thumbnail-strip')).toBeVisible();

    // Theme switch is reflected immediately in the live slide.
    await page.locator('.theme-option', { hasText: '极夜' }).click();
    await expect(page.locator('.stage-slide .slide')).toHaveAttribute('data-theme', 'midnight');
    await expect(page.locator('.stage-slide .slide')).toContainText('把复杂');

    // Stage navigation.
    await page.locator('.stage-controls button[aria-label="下一页"]').click();
    await expect(page.locator('.stage-page')).toContainText('02');
    await expect(page.locator('.stage-slide .slide')).toContainText('今天，我们聊三件事');

    // Presentation mode + keyboard.
    await page.getByRole('button', { name: '演示', exact: true }).click();
    const presentation = page.locator('.presentation');
    await expect(presentation).toBeVisible();
    await expect(presentation.locator('.presentation-count')).toContainText('02');
    await page.keyboard.press('ArrowRight');
    await expect(presentation.locator('.presentation-count')).toContainText('03');
    await page.keyboard.press('n');
    await expect(presentation.locator('.presentation-notes')).toHaveClass(/is-open/);
    await expect(presentation.locator('.presentation-notes')).toContainText('演讲者备注');
    await page.keyboard.press('t');
    await expect(presentation.locator('.slide')).toHaveAttribute('data-theme', /citrus|ink/);
    await page.getByRole('button', { name: '退出演示' }).click();
    await expect(presentation).toHaveCount(0);

    // Export a fully self-contained file.
    await expect(page.getByRole('button', { name: '导出 HTML' })).toBeEnabled();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 HTML' }).click();
    const download = await downloadPromise;
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/\.html$/);
    const filePath = testInfo.outputPath(fileName);
    await download.saveAs(filePath);
    const source = await readFile(filePath, 'utf8');
    expect(source.startsWith('<!doctype html>')).toBe(true);
    expect(source).toContain('data-theme-choice="ink"');
    expect(source).toContain('data-theme-choice="midnight"');
    expect(source).toContain('data-theme-choice="citrus"');
    expect(source).toContain('data-theme-choice="mono"');
    expect((source.match(/class="export-slide /g) ?? []).length).toBe(8);
    expect(source).not.toContain('<link rel="stylesheet"');

    const exported = await page.context().newPage();
    const exportErrors: string[] = [];
    exported.on('pageerror', (error) => exportErrors.push(error.message));
    await exported.goto(`file:///${filePath.replaceAll('\\', '/')}`);
    await expect(exported.locator('.export-slide.is-active')).toHaveCount(1);
    await expect(exported.locator('.export-counter')).toHaveText('01 / 08');
    await exported.keyboard.press('ArrowRight');
    await expect(exported.locator('.export-counter')).toHaveText('02 / 08');
    await exported.locator('[data-theme-choice="mono"]').click();
    await expect(exported.locator('.export-slide.is-active .slide')).toHaveAttribute(
      'data-theme',
      'mono',
    );
    await exported.locator('#notes-toggle').click();
    await expect(exported.locator('.notes')).toHaveClass(/is-open/);
    await exported.keyboard.press('Escape');
    await expect(exported.locator('.notes')).not.toHaveClass(/is-open/);
    expect(exportErrors).toEqual([]);
    await exported.close();

    expect(errors).toEqual([]);
    await testInfo.attach('ready-deck', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('works on a mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.health-pill')).toContainText('Mock AI');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await generateDeck(page);
    const overflowAfter = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflowAfter).toBeLessThanOrEqual(1);
    await expect(page.locator('.stage-slide .slide')).toBeVisible();
    await page.getByRole('button', { name: '演示', exact: true }).click();
    await expect(page.locator('.presentation')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.presentation-count')).toContainText('02');
    await page.getByRole('button', { name: '退出演示' }).click();
    expect(errors).toEqual([]);
  });

  test('serves a healthy API and streams structured slides', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBe(true);
    const body = (await health.json()) as { configured: boolean; mock: boolean; model: string };
    expect(body.mock).toBe(true);
    expect(body.configured).toBe(true);
    expect(body.model).toBe('deepseek-v4-pro');

    const short = await request.post('/api/generate', { data: { text: '太短' } });
    expect(short.status()).toBe(400);

    const response = await request.post('/api/generate', {
      data: {
        text: '这是一段足够长的测试文案。'.repeat(10),
        theme: 'citrus',
        slideCount: 6,
      },
    });
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/event-stream');
    const stream = await response.text();
    const events = stream
      .split('\n\n')
      .map((block) => block.match(/^event: (.+)$/m)?.[1])
      .filter(Boolean);
    expect(events).toContain('deck');
    expect(events).toContain('slide');
    expect(events).toContain('done');
    expect((stream.match(/event: slide/g) ?? []).length).toBe(6);
  });
});
