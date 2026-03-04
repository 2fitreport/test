const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  try {
    // 로그인
    await page.goto('http://192.168.0.4:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="user_id"]', 'admin');
    await page.fill('input[name="password"]', '12345');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    // user_create 페이지 이동
    await page.goto('http://192.168.0.4:3000/main/user_create', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    // 스크린샷
    await page.screenshot({ path: 'user-create-screenshot.png' });
    console.log('Screenshot saved');
    
    // affiliationSection 위치 확인
    const affiliationSection = page.locator('[class*="affiliationSection"]').first();
    const box = await affiliationSection.boundingBox();
    
    if (box) {
      console.log('\nafliliationSection 정보:');
      console.log('- 오른쪽 끝 위치:', box.x + box.width);
      
      const viewportSize = page.viewportSize();
      console.log('- 뷰포트 너비:', viewportSize?.width);
      
      const rightEdge = box.x + box.width;
      const viewportWidth = viewportSize?.width || 0;
      console.log('- 오른쪽 끝까지의 거리:', viewportWidth - rightEdge, 'px');
      console.log('- 화면 밖 넘침:', rightEdge > viewportWidth ? 'YES' : 'NO');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await browser.close();
})();
