import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const SCREENSHOTS_DIR = "D:/Điệp Web App/pgs-hub/docs/user-guide/screenshots";

async function run() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to login page...");
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "login.png") });
  console.log("Captured login.png");

  // Perform Login
  await page.fill('input[type="email"]', "uat.admin.local@pgs.test");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/app/**", { timeout: 15000 }).catch(() => console.log("Current URL:", page.url()));
  await page.waitForTimeout(2000);

  // Capture Dashboard
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "dashboard.png") });
  console.log("Captured dashboard.png");

  // Attendance
  await page.goto("http://localhost:3000/app/attendance", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "attendance.png") });
  console.log("Captured attendance.png");

  // Tasks
  await page.goto("http://localhost:3000/app/admin/tasks", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "tasks.png") });
  console.log("Captured tasks.png");

  // Kanban
  await page.goto("http://localhost:3000/app/admin/kanban", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "kanban.png") });
  console.log("Captured kanban.png");

  // Calendar
  await page.goto("http://localhost:3000/app/admin/calendar", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "calendar.png") });
  console.log("Captured calendar.png");

  // Workflow
  await page.goto("http://localhost:3000/app/admin/workflows", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "workflow.png") });
  console.log("Captured workflow.png");

  // Expenses
  await page.goto("http://localhost:3000/app/admin/finance", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "expenses.png") });
  console.log("Captured expenses.png");

  // Support
  await page.goto("http://localhost:3000/app/chat", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "support.png") });
  console.log("Captured support.png");

  await browser.close();
  console.log("ALL REAL SCREENSHOTS CAPTURED SUCCESSFULLY!");
}

run().catch(console.error);
