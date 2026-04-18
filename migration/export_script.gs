/**
 * GOOGLE APPS SCRIPT EXPORT SCRIPT
 * 
 * 1. Open your Google Sheet (ID: 1F1-S3cG4DAQJn4752KHUqqYQuC8dgHMbydfxUiYTGPA)
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code and run 'exportDataToJSON'
 * 4. Copy the output from the Execution Log
 */

function exportDataToJSON() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const exportData = {};

  sheets.forEach(sheet => {
    const name = sheet.getName();
    const data = sheet.getDataRange().getValues();
    if (data.length < 1) return;

    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index];
        }
      });
      return obj;
    });

    exportData[name] = rows;
  });

  const jsonString = JSON.stringify(exportData);
  
  // Tạo file trực tiếp vào Google Drive để không bị cắt dữ liệu
  const fileName = "data_export_" + ss.getName() + ".json";
  const file = DriveApp.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);
  
  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <p style="color: green; font-weight: bold;">✅ Xuất dữ liệu thành công!</p>
      <p>File đã được lưu vào Google Drive của bạn.</p>
      <p><b>Tên file:</b> ${fileName}</p>
      <p><a href="${file.getUrl()}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px;">Mở file để tải về</a></p>
      <p style="font-size: 12px; color: #666;">Sau khi mở link, hãy nhấn <b>Tải xuống</b>, sau đó mở file bằng Notepad và copy nội dung vào project.</p>
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(450)
    .setHeight(250);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Kết quả xuất dữ liệu');
}
