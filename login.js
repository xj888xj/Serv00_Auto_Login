const fs = require('fs');
const puppeteer = require('puppeteer');
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
  console.error('请设置 TELEGRAM_BOT_TOKEN 和 CHAT_ID 环境变量');
  return;
}

function formatToISO(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d{3}Z/, '');
}

async function delayTime(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('发送 Telegram 消息时出错:', error);
  }
}

(async () => {
  let accounts;
  try {
    const accountsJson = fs.readFileSync('accounts.json', 'utf-8');
    accounts = JSON.parse(accountsJson);
  } catch (error) {
    console.error('读取 accounts.json 时出错:', error);
    return;
  }

  await Promise.all(accounts.map(async (account) => {
    const { username, password, panelnum } = account;

    // 启动浏览器并添加 --no-sandbox 选项
    const browser = await puppeteer.launch({
      headless: true, // 生产环境
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    let url = `https://panel${panelnum}.serv00.com/login/?next=/`;

    try {
      await page.goto(url, { waitUntil: 'networkidle2' });

      await page.type('#id_username', username);
      await page.type('#id_password', password);

      const loginButton = await page.$('#submit');
      if (loginButton) {
        await loginButton.click();
      } else {
        throw new Error('无法找到登录按钮');
      }

      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      const isLoggedIn = await page.evaluate(() => {
        return document.querySelector('a[href="/logout/"]') !== null;
      });

      const nowUtc = formatToISO(new Date());
      const nowBeijing = formatToISO(new Date(new Date().getTime() + 8 * 60 * 60 * 1000));

      if (isLoggedIn) {
        const successMessage = `账号 ${username} 于北京时间 ${nowBeijing}（UTC时间 ${nowUtc}）登录成功！`;
        console.log(successMessage);
        await sendTelegramMessage(successMessage);
      } else {
        const failureMessage = `账号 ${username} 登录失败，请检查账号和密码是否正确。`;
        console.error(failureMessage);
        await sendTelegramMessage(failureMessage);
      }
    } catch (error) {
      const errorMessage = `账号 ${username} 登录时出现错误: ${error}`;
      console.error(errorMessage);
      await sendTelegramMessage(errorMessage);
    } finally {
      await page.close();
      await browser.close();
      const delay = Math.floor(Math.random() * 8000) + 1000;
      await delayTime(delay);
    }
  }));

  console.log('所有账号登录完成！');
})();
