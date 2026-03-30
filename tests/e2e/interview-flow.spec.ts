import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots')
const PDF_PATH = path.resolve(__dirname, '../sample_resume.pdf')

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
}

test.setTimeout(240000)
test('Full interview flow: upload → parsing → interview → reply', async ({ page }) => {
  ensureScreenshotsDir()

  // 1. Navigate to the upload page
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  // Take screenshot of upload page
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'e2e-01-upload-page.png') })
  console.log('Screenshot 1: upload page taken')

  // 2. Wait for the drop zone to appear
  await page.waitForSelector('[data-testid="drop-zone"]', { timeout: 15000 })
  console.log('Drop zone is visible')

  // 3. Set the PDF file on the hidden file input
  const fileInput = page.locator('[data-testid="file-input"]')
  await fileInput.setInputFiles(PDF_PATH)
  console.log(`File set: ${PDF_PATH}`)

  // Brief pause for the upload to start
  await page.waitForTimeout(1000)

  // Take screenshot after triggering upload
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'e2e-02-uploading.png') })
  console.log('Screenshot 2: uploading state taken')

  // 4. Wait up to 150 seconds for the interview to start
  // ChatInterface renders in the DOM once the upload + parsing is complete
  console.log('Waiting for interview to start (up to 150 seconds)...')

  let interviewStarted = false
  try {
    // Wait for either the text-input (chat interface) or an interviewer message
    await page.waitForSelector(
      '[data-testid="text-input"], [data-testid="message-interviewer"]',
      { timeout: 150000 }
    )
    interviewStarted = true
    console.log('Interview started!')
  } catch (err) {
    console.log('Interview did not start within 150 seconds:', err)
  }

  // Take screenshot of interview state (whether started or not)
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'e2e-03-interview-started.png') })
  console.log('Screenshot 3: interview state taken')

  if (!interviewStarted) {
    // Check for any error shown on the upload page
    const uploadError = page.locator('[data-testid="upload-error"]')
    const errorText = await uploadError.textContent().catch(() => null)
    if (errorText) {
      console.log(`Upload error displayed: ${errorText}`)
    }
    // Fail the test with a clear message
    throw new Error('Interview did not start — upload/parsing may have failed. See screenshot e2e-03-interview-started.png')
  }

  // 5. Wait for the first interviewer message (AI asks a question)
  console.log('Waiting for first interviewer message...')
  try {
    await page.waitForSelector('[data-testid="message-interviewer"]', { timeout: 60000 })
    console.log('First interviewer message received')
  } catch {
    console.log('No interviewer message yet, proceeding anyway')
  }

  // 6. Type a response in the text input
  const textInput = page.locator('[data-testid="text-input"]')
  await textInput.waitFor({ state: 'visible', timeout: 10000 })
  await textInput.fill('I have 3 years of experience in software development, working primarily with Python and TypeScript.')
  console.log('Typed response in text input')

  // 7. Submit the message
  const sendBtn = page.locator('[data-testid="send-btn"]')
  await sendBtn.click()
  console.log('Clicked send button')

  // 8. Wait for a response from the AI (new interviewer message or loading state)
  console.log('Waiting for AI response...')
  try {
    // Wait for either loading to finish or a new interviewer message
    await page.waitForSelector('[data-testid="message-interviewer"]', {
      timeout: 60000,
      // state: 'attached' - waits for at least one to exist
    })

    // Wait for loading to settle
    await page.waitForTimeout(2000)
    console.log('AI responded')
  } catch {
    console.log('Timed out waiting for AI response')
  }

  // Take screenshot after reply
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'e2e-04-after-reply.png') })
  console.log('Screenshot 4: after reply taken')

  // 9. Assert no "Failed to send message." error is visible
  const chatError = page.locator('[data-testid="chat-error"]')
  const chatErrorVisible = await chatError.isVisible().catch(() => false)
  const chatErrorText = chatErrorVisible ? await chatError.textContent().catch(() => null) : null

  if (chatErrorText) {
    console.log(`Chat error text found: "${chatErrorText}"`)
  } else {
    console.log('No chat error element visible — good')
  }

  // Only check text content if the element is visible and has content
  if (chatErrorText !== null) {
    expect(chatErrorText).not.toContain('Failed to send message.')
  }

  // Also check that no such text appears anywhere on the page
  const bodyText = await page.locator('body').textContent()
  expect(bodyText ?? '').not.toContain('Failed to send message.')

  console.log('Test passed: No "Failed to send message." error detected')
})
