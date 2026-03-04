const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://192.168.0.4:3000/signup', { waitUntil: 'networkidle' });

  // 비밀번호만 입력 (모두 잘못된 값)
  await page.fill('input[name="user_id"]', 'testuser');
  await page.fill('input[name="password"]', '123');

  // 폼 제출
  await page.keyboard.press('Enter');

  // 모달이 나타날 때까지 기다리기
  await page.waitForTimeout(2000);

  // 화면의 모든 요소 인쇄
  const bodyHTML = await page.content();
  const messageMatch = bodyHTML.match(/<div[^>]*class="[^"]*message[^"]*"[^>]*>[^<]*영문[^<]*<\/div>/);

  if (messageMatch) {
    console.log('Found message div:');
    console.log(messageMatch[0]);
  } else {
    console.log('Message div not found');
    // p 태그 찾기
    const pMatch = bodyHTML.match(/<p[^>]*class="[^"]*message[^"]*"[^>]*>[^<]*영문[^<]*<\/p>/);
    if (pMatch) {
      console.log('Found message p:');
      console.log(pMatch[0]);
    }
  }

  // 스크린샷
  await page.screenshot({ path: 'simple-test.png' });
  console.log('Screenshot saved');

  await browser.close();
})();
