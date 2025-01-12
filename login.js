npm install axios --save

const fs = require('fs');
const puppeteer = require('puppeteer');
const axios = require('axios'); // 用于发送 HTTP 请求

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // 从环境变量获取 Bot Token
const CHAT_ID = process.env.CHAT_ID; // 从环境变量获取 Chat ID

function formatToISO(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d{3}Z/, '');
}

async function delayTime(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: CHAT_ID,
    text: message,
    parse_mode: 'HTML', // 可选，支持 HTML 格式
  });
}

(async () => {
  const accountsJson = fs.readFileSync('accounts.json', 'utf-8');
  const accounts = JSON.parse(accountsJson);

  for (const account of accounts) {
    const { username, password, panelnum } = account;

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    let url = `https://panel${panelnum}.serv00.com/login/?next=/`;

    try {
      await page.goto(url, { waitUntil: 'networkidle2' });

      const usernameInput = await page.$('#id_username');
      if (usernameInput) {
        await usernameInput.click({ clickCount: 3 });
        await usernameInput.press('Backspace');
      }

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
        await sendTelegramMessage(successMessage); // 发送成功消息
      } else {
        const failureMessage = `账号 ${username} 登录失败，请检查账号和密码是否正确。`;
        console.error(failureMessage);
        await sendTelegramMessage(failureMessage); // 发送失败消息
      }
    } catch (error) {
      const errorMessage = `账号 ${username} 登录时出现错误: ${error}`;
      console.error(errorMessage);
      await sendTelegramMessage(errorMessage); // 发送错误消息
    } finally {
      await page.close();
      await browser.close();
      const delay = Math.floor(Math.random() * 8000) + 1000;
      await delayTime(delay);
    }
  }

  console.log('所有账号登录完成！');
})();
