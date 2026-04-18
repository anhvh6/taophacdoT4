import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '../../../.puppeteer_data');

function extractVideoId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\n]+)/);
  return match ? match[1] : null;
}

export async function runYoutubeAutomation(
  action: 'assign' | 'unassign',
  email: string,
  links: string[]
): Promise<{ success: boolean; successCount: number; failedCount: number; errors: any[] }> {
  let successCount = 0;
  let failedCount = 0;
  const errors: any[] = [];

  const videoIds = links.map(extractVideoId).filter(Boolean);
  if (videoIds.length === 0) return { success: true, successCount: 0, failedCount: 0, errors: [] };

  // Khởi động trình duyệt
  const isHeadless = process.env.YOUTUBE_HEADLESS === 'false' ? false : "new";
  
  const browser = await puppeteer.launch({
    headless: isHeadless,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: ['--start-maximized', '--window-size=1920,1080', '--disable-notifications']
  });

  try {
    const page = await browser.newPage();
    
    for (const videoId of videoIds) {
      if (!videoId) continue;
      
      try {
        const url = `https://studio.youtube.com/video/${videoId}/edit`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // NẾU TÀI KHOẢN CHƯA ĐĂNG NHẬP (Chuyển hướng qua trang Google Login)
        if (page.url().includes('accounts.google.com') || page.url().includes('ServiceLogin')) {
          if (isHeadless !== false) {
             throw new Error("YÊU CẦU ĐĂNG NHẬP LẦN ĐẦU: Hệ thống ngầm phát hiện chưa có session Youtube. Hãy tạm đổi YOUTUBE_HEADLESS=false trong file .env, khởi động lại server và đăng nhập thủ công 1 lần.");
          } else {
             console.log(`[YouTube Automation] Chờ đăng nhập thủ công cho video ${videoId}... Vui lòng đăng nhập trên trình duyệt để tiếp tục.`);
             await new Promise(r => setTimeout(r, 60000)); // Đợi 60s để user đăng nhập
          }
        }
        
        // Đảm bảo là đã tải xong youtube studio
        await page.waitForSelector('#visibility-stepper, #audience-and-visibility', { timeout: 15000 }).catch(() => {
          throw new Error("Không thể tải trang chỉnh sửa video. Có thể video lỗi hoặc quyền truy cập bị từ chối.");
        });

        // 1. Click vào phần Hiển thị (Visibility)
        await page.evaluate(() => {
          const visStepper = document.querySelector('#visibility-stepper') as HTMLElement;
          if (visStepper) visStepper.click();
          else {
            const btn = Array.from(document.querySelectorAll('ytcp-text-dropdown-trigger')).find(el => el.textContent?.includes('riêng tư') || el.textContent?.includes('công khai') || el.textContent?.includes('Không') || el.textContent?.includes('Private'));
            if (btn) (btn as HTMLElement).click();
          }
        });

        await new Promise(r => setTimeout(r, 2000));

        // 2. Chọn "Riêng tư" (Private) nếu chưa chọn, sau đó nhấn "Chia sẻ riêng tư" (Share privately)
        await page.evaluate(() => {
          // Bật popup
          const privateRadio = document.querySelector('tp-yt-paper-radio-button[name="PRIVATE"]') as HTMLElement;
          if (privateRadio) privateRadio.click();
        });

        await new Promise(r => setTimeout(r, 1000));

        // Nhấn nút "Chia sẻ riêng tư"
        const clickedShare = await page.evaluate(() => {
          const shareBtns = Array.from(document.querySelectorAll('ytcp-button')).filter(b => b.textContent?.toLowerCase().includes('chia sẻ riêng tư') || b.textContent?.toLowerCase().includes('share privately'));
          for (const btn of shareBtns) {
            if (btn.getBoundingClientRect().width > 0) {
              (btn as HTMLElement).click();
              return true;
            }
          }
          return false;
        });

        if (!clickedShare) throw new Error("Không tìm thấy nút 'Chia sẻ riêng tư'");

        await new Promise(r => setTimeout(r, 2000));

        // 3. Thực hiện Assign hoặc Unassign
        if (action === 'assign') {
          // Nhập email vào textbox
          await page.evaluate((customerEmail) => {
            const input = document.querySelector('.ytcp-form-input-container textarea, iron-autogrow-textarea textarea') as HTMLTextAreaElement;
            if (input) {
              input.value = customerEmail;
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, email);

          // Bấm enter hoặc blur
          await page.keyboard.press('Enter');
          await new Promise(r => setTimeout(r, 1000));

          // Bắt buộc (hoặc bỏ) tích "Thông báo qua email" (Notify via email)
          // Có thể tìm checkbox "Thông báo qua email"
          await page.evaluate(() => {
            const cb = document.querySelector('tp-yt-paper-checkbox[name="notify"]') as any;
            // Uncheck nếu không muốn gửi mail rác (tùy tuỳ user), mặc định để nguyên
            if (cb ) cb.checked = false; // tạm tắt để đỡ phiền học viên liên tục, nếu muốn gửi thì bỏ dòng này
          });
        } 
        else if (action === 'unassign') {
           // Tìm email đó trong danh sách những người đã chia sẻ và xoá nó
           await page.evaluate((customerEmail) => {
             const items = Array.from(document.querySelectorAll('ytcp-video-share-chip, .ytcp-video-share-chip'));
             for (const item of items) {
               if (item.textContent?.includes(customerEmail)) {
                 const deleteBtn = item.querySelector('iron-icon[icon="yt-sys:close"], .remove-button, button') as HTMLElement;
                 if (deleteBtn) deleteBtn.click();
               }
             }
           }, email);
        }

        await new Promise(r => setTimeout(r, 1000));

        // 4. Nhấn nút "Xong" (Done) trên popup chia sẻ
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('ytcp-button')).filter(b => 
            b.textContent?.trim().toLowerCase() === 'xong' || 
            b.textContent?.trim().toLowerCase() === 'done' ||
            (b.id === 'done-button')
          );
          for (const btn of btns) {
            if (btn.getBoundingClientRect().width > 0) {
              (btn as HTMLElement).click();
              break;
            }
          }
        });

        await new Promise(r => setTimeout(r, 1000));

        // Nhấn nút "Lưu" ở popup visibility (Nếu có)
        await page.evaluate(() => {
          const saveBtnVis = document.querySelector('#save-button') as HTMLElement;
          if (saveBtnVis && saveBtnVis.getBoundingClientRect().width > 0) saveBtnVis.click();
        });

        await new Promise(r => setTimeout(r, 1500));
        
        // 5. Nhấn nút "Lưu" góc trên bên phải
        await page.evaluate(() => {
          const saveBtnMain = document.querySelector('#save') as HTMLElement;
          if (saveBtnMain && !saveBtnMain.hasAttribute('disabled')) saveBtnMain.click();
        });

        // Đợi lưu hoàn thành (đợi toast notification hoặc đợi vài giây)
        await new Promise(r => setTimeout(r, 3000));
        
        successCount++;
        console.log(`[YouTube Automation] Thành công video ${videoId}`);

      } catch (err: any) {
        console.error(`[YouTube Automation] Lỗi video ${videoId}:`, err.message);
        failedCount++;
        errors.push({ videoId, error: err.message });
      }
    }
  } catch (error: any) {
     console.error("[YouTube Automation] Lỗi khởi tạo trình duyệt:", error);
  } finally {
    await browser.close();
  }

  return { 
    success: successCount === videoIds.length && failedCount === 0, 
    successCount, 
    failedCount, 
    errors 
  };
}
