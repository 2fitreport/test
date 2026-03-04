const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://192.168.0.4:3000/signup', { waitUntil: 'networkidle' });

  // 필수 필드 채우기
  await page.fill('input[name="user_id"]', 'testuser');

  // 중복 확인 버튼 클릭
  await page.click('button:has-text("중복 확인")');
  await page.waitForTimeout(1500);

  // 모달 닫기 (확인 버튼 클릭)
  const confirmButton = page.locator('[class*="Modal-module"] button').first();
  await confirmButton.click();
  await page.waitForTimeout(500);

  // 비밀번호 잘못된 값 입력 (유효성 검사 실패)
  await page.fill('input[name="password"]', '123');
  await page.fill('input[name="confirmPassword"]', '123');
  await page.fill('input[name="name"]', '테스트');
  await page.fill('input[name="email"]', 'test@test.com');
  await page.fill('input[name="phone"]', '01012345678');
  await page.fill('input[name="address"]', '서울시');
  await page.fill('input[name="resident_id"]', '123456-1234567');
  await page.fill('input[name="bank_name"]', '은행');
  await page.fill('input[name="account_holder"]', '예금주');
  await page.fill('input[name="account_number"]', '1234567890');

  // 회원가입 버튼 클릭
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();

  // 모달 메시지 확인
  await page.waitForTimeout(1000);

  // 더 일반적인 선택자 사용
  const allDivs = await page.locator('div').all();
  console.log(`Total divs: ${allDivs.length}`);

  let modalMessage = null;
  for (const div of allDivs) {
    const classes = await div.getAttribute('class');
    if (classes && classes.includes('message')) {
      const html = await div.innerHTML();
      if (html.includes('영문')) {
        modalMessage = div;
        console.log('\n=== Found Message Element ===');
        console.log(`Classes: ${classes}`);
        break;
      }
    }
  }

  if (!modalMessage) {
    console.log('Message element not found!');
    await browser.close();
    return;
  }

  const text = await modalMessage.textContent();
  const html = await modalMessage.innerHTML();

  console.log('=== Modal Message Text ===');
  console.log(text);
  console.log('\n=== Modal Message HTML ===');
  console.log(html);

  // CSS computed style 확인
  const computedStyle = await modalMessage.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      whiteSpace: style.whiteSpace,
      display: style.display,
      lineHeight: style.lineHeight,
      maxWidth: style.maxWidth,
    };
  });

  console.log('\n=== Computed CSS ===');
  console.log(JSON.stringify(computedStyle, null, 2));

  // 스크린샷 저장
  await page.screenshot({ path: 'signup-test.png' });
  console.log('\n스크린샷 저장됨: signup-test.png');

  await browser.close();
})();
