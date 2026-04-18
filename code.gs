
/**
 * MEGA PHƯƠNG - BACKEND CORE (Google Apps Script)
 * Hệ thống quản lý phác đồ Yoga Face 30 ngày.
 */

const SPREADSHEET_ID = '1F1-S3cG4DAQJn4752KHUqqYQuC8dgHMbydfxUiYTGPA';
const MASTER_SHEET_NAME = 'Lich phac do';
const CUSTOMER_SHEET_NAME = 'Customers';
const PRODUCT_SHEET_NAME = 'Sản phẩm';
const PLAN_SHEET_NAME = 'Lịch trình';
const COURSE_SHEET_NAME = 'Khóa học';
const TIMEZONE = "Asia/Ho_Chi_Minh";

let FORCE_REFRESH = false;

function toDateKey_Global(input) {
  if (!input) return "";
  if (input instanceof Date) {
    if (isNaN(input.getTime()) || input.getTime() === 0) return "";
    return Utilities.formatDate(input, TIMEZONE, "yyyy-MM-dd");
  }
  let s = String(input).trim();
  if (!s || s === "0" || s.startsWith("1970") || s.startsWith("01/01/1970")) return "";
  
  // Tối ưu: Nếu đã đúng định dạng yyyy-mm-dd thì trả về luôn
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  if (s.includes('T')) s = s.split('T')[0];
  let parts = s.split(/[/-]/);
  if (parts.length === 3) {
    let d, m, y;
    if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; }
    else { d = parts[0]; m = parts[1]; y = parts[2]; }
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return s;
}

function toDate_Global(input) {
  const k = toDateKey_Global(input);
  if (!k) return null;
  const p = k.split('-');
  return new Date(p[0], p[1]-1, p[2]);
}

function getSheetSmart_(ss, targetName) {
  const sheets = ss.getSheets();
  const normalizedTarget = targetName.toLowerCase().replace(/\s+/g, '');
  let sheet = ss.getSheetByName(targetName);
  if (sheet) return sheet;
  for (let s of sheets) {
    const sName = s.getName().toLowerCase().replace(/\s+/g, '');
    if (sName.includes(normalizedTarget) || normalizedTarget.includes(sName)) return s;
  }
  return null;
}

const GLOBAL_CACHE = {};

function dbReadSheet_Global(ss, name) {
  const cacheKey = SPREADSHEET_ID + "_" + name;
  if (!FORCE_REFRESH && GLOBAL_CACHE[cacheKey]) return GLOBAL_CACHE[cacheKey];

  if (FORCE_REFRESH) {
    SpreadsheetApp.flush();
  }

  const scriptCache = CacheService.getScriptCache();
  
  if (!FORCE_REFRESH) {
    // Thử đọc cache chunked
    try {
      const meta = scriptCache.get(cacheKey + "_meta");
      if (meta) {
        const { chunks } = JSON.parse(meta);
        let fullString = "";
        for (let i = 0; i < chunks; i++) {
          const chunk = scriptCache.get(cacheKey + "_chunk_" + i);
          if (!chunk) { fullString = ""; break; }
          fullString += chunk;
        }
        if (fullString) {
          const data = JSON.parse(fullString);
          GLOBAL_CACHE[cacheKey] = data;
          return data;
        }
      }
    } catch (e) {}
  }

  const s = getSheetSmart_(ss, name);
  if (!s) return [];
  const v = s.getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0].map(x => String(x || "").toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));
  
  const dateCols = h.map((x, j) => ['start_date', 'end_date', 'video_date'].includes(x) ? j : -1).filter(j => j !== -1);
  const isMasterOrPlan = (name === MASTER_SHEET_NAME || name === PLAN_SHEET_NAME);

  const data = v.slice(1).map((r, i) => {
    const o = { _rowNumber: i + 2 };
    let hasContent = false;
    
    for (let j = 0; j < h.length; j++) {
      let val = r[j];
      if (val !== "" && val !== null && val !== undefined) hasContent = true;
      o[h[j]] = val;
    }

    if (!hasContent) return null;

    // Chỉ format date cho các cột cần thiết
    dateCols.forEach(j => {
      o[h[j]] = toDateKey_Global(o[h[j]]);
    });

    if (isMasterOrPlan) {
      o.title = o.ten_bai_tap || o.bai_tap || o.title || "";
      o.detail = o.chi_tiet || o.noi_dung || o.detail || "";
      o.link = o.link_video || o.video || o.link || "";
      o.type = o.loai || o.phan_loai || o.type || "Bài bắt buộc";
      o.day = Number(o.n || o.ngay || o.day || 0);
    }
    return o;
  }).filter(x => x !== null);

  // Lưu vào cache chunked (mỗi chunk 90KB)
  try {
    const stringified = JSON.stringify(data);
    const chunkSize = 90000;
    const chunks = Math.ceil(stringified.length / chunkSize);
    
    if (chunks <= 15) { // Tối đa ~1.3MB
      for (let i = 0; i < chunks; i++) {
        scriptCache.put(cacheKey + "_chunk_" + i, stringified.substring(i * chunkSize, (i + 1) * chunkSize), 300);
      }
      scriptCache.put(cacheKey + "_meta", JSON.stringify({ chunks }), 300);
    }
  } catch (e) {}

  GLOBAL_CACHE[cacheKey] = data;
  return data;
}

// Hàm để xóa cache khi có thay đổi dữ liệu
function clearSheetCache_Global(name) {
  const scriptCache = CacheService.getScriptCache();
  const cacheKey = SPREADSHEET_ID + "_" + name;
  scriptCache.remove(cacheKey + "_meta");
  for (let i = 0; i < 15; i++) {
    scriptCache.remove(cacheKey + "_chunk_" + i);
  }
  scriptCache.remove(cacheKey);
}

function clearAllCache_Global() {
  const sheets = [CUSTOMER_SHEET_NAME, PRODUCT_SHEET_NAME, MASTER_SHEET_NAME, PLAN_SHEET_NAME, COURSE_SHEET_NAME];
  sheets.forEach(clearSheetCache_Global);
}

function calculateAccessState(customer) {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = toDate_Global(customer.start_date);
  const end = toDate_Global(customer.end_date);
  
  let allowed = 0, state = "ACTIVE";
  if (start) {
    allowed = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
    if (allowed < 1) state = "NOT_STARTED";
  }
  
  if (customer.status === 'DELETED' || customer.status === 'INACTIVE') state = "DELETED";
  else if (end && today > end) state = "EXPIRED";
  
  return { state, allowed_day: Math.max(0, allowed) };
}

function getPlanData(ss, id, date, customerObj) {
  const customer = customerObj || dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME).find(c => String(c.customer_id).trim() === String(id).trim());
  const isCustomized = customer ? (String(customer.is_customized) === "1" || customer.is_customized === true) : false;

  if (isCustomized && id && id !== "NEW") {
    const studentTasks = dbReadSheet_Global(ss, PLAN_SHEET_NAME)
      .filter(t => String(t.customer_id).trim() === String(id).trim());
    
    if (studentTasks.length > 0) {
      return studentTasks.map(t => {
        t._is_master = false;
        return t;
      }).sort((a, b) => Number(a.day) - Number(b.day));
    }
  }

  const masterKey = toDateKey_Global(date);
  if (!masterKey) return [];
  
  const allMasterTasks = dbReadSheet_Global(ss, MASTER_SHEET_NAME);
  return allMasterTasks
    .filter(t => toDateKey_Global(t.video_date) === masterKey)
    .map(t => {
      t._is_master = true;
      return t;
    })
    .sort((a, b) => Number(a.day) - Number(b.day));
}

function doGet(e) {
  FORCE_REFRESH = e.parameter.force === 'true';
  const u = e.parameter.u;
  const t = e.parameter.t;
  const action = e.parameter.action;

  if (u && t && !action) {
    return renderStudentPage(u, t);
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let res;
  try {
    switch (action) {
      case 'getCustomers': res = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME); break;
      case 'getCustomer': 
        const cId = String(e.parameter.id);
        const reqToken = e.parameter.token;
        const cObj = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME).find(c => String(c.customer_id) === cId);
        
        if (reqToken) {
          if (!cObj || String(cObj.token) !== String(reqToken)) {
            throw new Error('ACCESS_DENIED');
          }
        }
        
        if (cObj) {
          const acc = calculateAccessState(cObj);
          cObj.access_state = acc.state;
          cObj.allowed_day = acc.allowed_day;
        }
        res = cObj;
        break;
      case 'getPlan': 
        const pCustId = String(e.parameter.customerId);
        const pToken = e.parameter.token;
        
        if (pToken) {
          const pCust = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME).find(c => String(c.customer_id) === pCustId);
          if (!pCust || String(pCust.token) !== String(pToken)) {
            throw new Error('ACCESS_DENIED');
          }
        }
        
        res = getPlanData(ss, e.parameter.customerId, e.parameter.videoDate); 
        break;
      case 'getVideoDates': 
        const masterSheet = getSheetSmart_(ss, MASTER_SHEET_NAME);
        if (!masterSheet) res = [];
        else {
          const v = masterSheet.getDataRange().getValues();
          const headers = v[0].map(x => String(x||"").toLowerCase().trim());
          const vdIdx = headers.indexOf("video_date");
          const set = new Set();
          for(let i=1; i<v.length; i++) {
            const k = toDateKey_Global(v[i][vdIdx]);
            if(k) set.add(k);
          }
          res = Array.from(set).sort().reverse();
        }
        break;
      case 'getVideoGroups':
        const m = dbReadSheet_Global(ss, MASTER_SHEET_NAME);
        const custs = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME);
        const groups = {};
        m.forEach(t => {
          const k = toDateKey_Global(t.video_date);
          if (!k) return;
          if (!groups[k]) groups[k] = { video_date_key: k, video_date: t.video_date, total_tasks: 0, mandatory_tasks: 0, optional_tasks: 0, days: new Set() };
          groups[k].total_tasks++;
          const type = String(t.type || t.loai || "").toLowerCase();
          if (type.includes("bắt buộc") || type.includes("bat buoc")) groups[k].mandatory_tasks++;
          else groups[k].optional_tasks++;
          groups[k].days.add(Number(t.day) || 0);
        });
        res = Object.values(groups).map(g => {
          g.total_days = g.days.size;
          g.active_students = custs.filter(x => toDateKey_Global(x.video_date) === g.video_date_key && x.status !== "DELETED").length;
          delete g.days;
          return g;
        });
        break;
      case 'getProducts': res = dbReadSheet_Global(ss, PRODUCT_SHEET_NAME); break;
      case 'getCourses': res = dbReadSheet_Global(ss, COURSE_SHEET_NAME); break;
      case 'getPlanEditorData':
        const editorId = e.parameter.id;
        const editorTempId = e.parameter.templateId;
        const editorRes = {
          dates: [],
          products: [],
          customer: null,
          template: null,
          tasks: []
        };
        
        // Tối ưu lấy danh sách ngày từ MASTER_SHEET_NAME
        const mSheet = getSheetSmart_(ss, MASTER_SHEET_NAME);
        if (mSheet) {
          const v = mSheet.getDataRange().getValues();
          if (v.length > 1) {
            const h = v[0].map(x => String(x||"").toLowerCase().trim());
            const vdIdx = h.indexOf("video_date");
            if (vdIdx > -1) {
              const dateSet = new Set();
              for (let i = 1; i < v.length; i++) {
                const k = toDateKey_Global(v[i][vdIdx]);
                if (k) dateSet.add(k);
              }
              editorRes.dates = Array.from(dateSet).sort().reverse();
            }
          }
        }
        
        editorRes.products = dbReadSheet_Global(ss, PRODUCT_SHEET_NAME);
        const allCusts = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME);
        if (editorId && editorId !== "undefined" && editorId !== "null" && editorId !== "NEW") {
          editorRes.customer = allCusts.find(c => String(c.customer_id) === String(editorId));
          if (editorRes.customer && !editorTempId) {
            editorRes.tasks = getPlanData(ss, editorId, editorRes.customer.video_date, editorRes.customer);
          }
        }
        if (editorTempId && editorTempId !== "undefined" && editorTempId !== "null") {
          editorRes.template = allCusts.find(c => String(c.customer_id) === String(editorTempId));
          if (editorRes.template) {
            editorRes.tasks = getPlanData(ss, editorTempId, editorRes.template.video_date, editorRes.template);
          }
        } else if (!editorId || editorId === "NEW") {
          const latest = editorRes.dates.length > 0 ? editorRes.dates[0] : null;
          if (latest) editorRes.tasks = getPlanData(ss, "NEW", latest);
        }
        res = editorRes;
        break;
      case 'getClientData':
        const clientId = e.parameter.id;
        const clientToken = e.parameter.token;
        const clientRes = { customer: null, tasks: [] };
        
        // Thử đọc cache cho toàn bộ client data nếu không force refresh
        const fullClientCacheKey = "FULL_CLIENT_" + clientId;
        if (!FORCE_REFRESH) {
          const cachedFull = CacheService.getScriptCache().get(fullClientCacheKey);
          if (cachedFull) {
            try {
              res = JSON.parse(cachedFull);
              return ContentService.createTextOutput(JSON.stringify({success:true, data:res})).setMimeType(ContentService.MimeType.JSON);
            } catch(e) {}
          }
        }

        const allC = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME);
        const found = allC.find(c => String(c.customer_id) === String(clientId));
        if (found) {
          if (clientToken && clientToken !== "undefined" && String(found.token) !== String(clientToken)) {
            res = { success: false, error: "ACCESS_DENIED" };
            return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
          }
          
          // Tính toán trạng thái truy cập và cảnh báo hết hạn
          const acc = calculateAccessState(found);
          found.access_state = acc.state;
          found.allowed_day = acc.allowed_day;
          
          const today = new Date(); today.setHours(0,0,0,0);
          const end = toDate_Global(found.end_date);
          found.expire_warning = (acc.state === "ACTIVE" && end && ((end.getTime() - today.getTime()) / 86400000) <= 5);
          
          clientRes.customer = found;
          clientRes.tasks = getPlanData(ss, clientId, found.video_date, found);
          
          // Lưu cache cho toàn bộ response (60 giây để đảm bảo tính cập nhật nhưng vẫn nhanh)
          try {
            CacheService.getScriptCache().put(fullClientCacheKey, JSON.stringify(clientRes), 60);
          } catch(e) {}
        }
        res = clientRes;
        break;
      case 'test': res = "OK"; break;
      default: res = "Action not found";
    }
    return ContentService.createTextOutput(JSON.stringify({success:true, data:res})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) { 
    return ContentService.createTextOutput(JSON.stringify({success:false, error:err.toString()})).setMimeType(ContentService.MimeType.JSON); 
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    let res;
    
    switch (action) {
      case 'upsertCustomer': {
        res = upsertCustomer_Backend(ss, postData.payload);
        clearSheetCache_Global(CUSTOMER_SHEET_NAME);
        if (postData.payload.hasOwnProperty('tasks')) clearSheetCache_Global(PLAN_SHEET_NAME);
        break;
      }
      case 'saveProducts': {
        const pSheet = getSheetSmart_(ss, PRODUCT_SHEET_NAME);
        const pHeaders = ["ID_SP", "Ten_SP", "Gia_Nhap", "Gia_Ban", "Trang_Thai"];
        const pRows = [pHeaders, ...postData.payload.map(x => [x.id_sp, x.ten_sp, x.gia_nhap, x.gia_ban, x.trang_thai])];
        pSheet.clearContents().getRange(1, 1, pRows.length, 5).setValues(pRows);
        clearSheetCache_Global(PRODUCT_SHEET_NAME);
        res = true;
        break;
      }
      case 'saveCourses': {
        const cSheet = getSheetSmart_(ss, COURSE_SHEET_NAME);
        const cHeaders = ["ID", "Name", "Description", "Fee", "Duration", "Status"];
        const cRows = [cHeaders, ...postData.payload.map(x => [x.id, x.name, x.description, x.fee, x.duration, x.status])];
        cSheet.clearContents().getRange(1, 1, cRows.length, 6).setValues(cRows);
        clearSheetCache_Global(COURSE_SHEET_NAME);
        res = true;
        break;
      }
      case 'deleteCustomer': {
        const customerIdToDelete = String(postData.id);
        
        // 1. Xóa trong sheet Customers (Dùng filter để nhanh hơn deleteRow)
        const cSheet = getSheetSmart_(ss, CUSTOMER_SHEET_NAME);
        const cValues = cSheet.getDataRange().getValues();
        const cHeaders = cValues[0];
        const cIdIdx = cHeaders.map(h => String(h||"").toLowerCase()).indexOf("customer_id");
        
        if (cIdIdx > -1) {
          const cNewRows = cValues.filter((row, idx) => idx === 0 || String(row[cIdIdx]) !== customerIdToDelete);
          if (cNewRows.length < cValues.length) {
            cSheet.clearContents();
            cSheet.getRange(1, 1, cNewRows.length, cHeaders.length).setValues(cNewRows);
            clearSheetCache_Global(CUSTOMER_SHEET_NAME);
          }
        }
        
        // 2. Xóa trong sheet Lịch trình (Dùng filter)
        const pSheet = getSheetSmart_(ss, PLAN_SHEET_NAME);
        if (pSheet) {
          const pValues = pSheet.getDataRange().getValues();
          const pHeaders = pValues[0];
          if (pValues.length > 1) {
            const pNewRows = pValues.filter((row, idx) => idx === 0 || String(row[0]) !== customerIdToDelete);
            if (pNewRows.length < pValues.length) {
              pSheet.clearContents();
              pSheet.getRange(1, 1, pNewRows.length, pHeaders.length).setValues(pNewRows);
              clearSheetCache_Global(PLAN_SHEET_NAME);
            }
          }
        }
        res = true;
        break;
      }
      case 'saveVideoGroupTasks': {
        const mSheet = getSheetSmart_(ss, MASTER_SHEET_NAME);
        const mKey = toDateKey_Global(postData.videoDate);
        const mValues = mSheet.getDataRange().getValues();
        const mHeaders = mValues[0];
        const headersLower = mHeaders.map(h => String(h||"").toLowerCase());
        const mVdIdx = headersLower.indexOf("video_date");
        const mNewRows = [mHeaders];
        for (let i = 1; i < mValues.length; i++) {
          if (toDateKey_Global(mValues[i][mVdIdx]) !== mKey) mNewRows.push(mValues[i]);
        }
        postData.tasks.forEach(t => {
          const newRow = new Array(mHeaders.length).fill("");
          headersLower.forEach((h, j) => {
            if (h === 'day' || h === 'n' || h === 'ngay') newRow[j] = t.day || 0;
            else if (h === 'type' || h === 'loai') newRow[j] = t.type || "";
            else if (h === 'title' || h === 'ten_bai_tap') newRow[j] = t.title || "";
            else if (h === 'detail' || h === 'chi_tiet') newRow[j] = t.detail || "";
            else if (h === 'link' || h === 'link_video') newRow[j] = t.link || "";
            else if (h === 'video_date') newRow[j] = mKey;
          });
          mNewRows.push(newRow);
        });
        mSheet.clearContents().getRange(1, 1, mNewRows.length, mHeaders.length).setValues(mNewRows);
        clearSheetCache_Global(MASTER_SHEET_NAME);
        res = true;
        break;
      }
      case 'deleteVideoTask': {
        getSheetSmart_(ss, MASTER_SHEET_NAME).deleteRow(postData.rowNumber);
        clearSheetCache_Global(MASTER_SHEET_NAME);
        res = true;
        break;
      }
      case 'deleteVideoGroup': {
        const mgSheet = getSheetSmart_(ss, MASTER_SHEET_NAME);
        const mgValues = mgSheet.getDataRange().getValues();
        const mgHeaders = mgValues[0];
        const mgVdIdx = mgHeaders.map(h => String(h||"").toLowerCase()).indexOf("video_date");
        
        const mgNewRows = mgValues.filter((row, idx) => idx === 0 || toDateKey_Global(row[mgVdIdx]) !== postData.videoDateKey);
        if (mgNewRows.length < mgValues.length) {
          mgSheet.clearContents();
          mgSheet.getRange(1, 1, mgNewRows.length, mgHeaders.length).setValues(mgNewRows);
          clearSheetCache_Global(MASTER_SHEET_NAME);
        }
        res = true;
        break;
      }
      default: throw new Error('Action not supported: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({success:true, data:res})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) { 
    return ContentService.createTextOutput(JSON.stringify({success:false, error:err.toString()})).setMimeType(ContentService.MimeType.JSON); 
  }
}

function upsertCustomer_Backend(ss, payload) {
  const sheet = getSheetSmart_(ss, CUSTOMER_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h || "").toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));

  if (!payload.customer_id || String(payload.customer_id).startsWith('NEW')) {
    payload.customer_id = 'C' + new Date().getTime();
    payload.token = Math.random().toString(36).substring(2, 10);
    payload.status = 'ACTIVE';
    payload.created_at = new Date().toISOString();
  }
  payload.updated_at = new Date().toISOString();
  
  if (payload.hasOwnProperty('tasks')) {
    payload.is_customized = (Array.isArray(payload.tasks) && payload.tasks.length > 0) ? 1 : 0;
  }

  if (payload.start_date && payload.duration_days) {
    const sDate = toDate_Global(payload.start_date);
    if (sDate) {
      const eDate = new Date(sDate.getTime());
      eDate.setDate(eDate.getDate() + Number(payload.duration_days));
      payload.end_date = toDateKey_Global(eDate);
    }
  }

  const NETLIFY_CLIENT_BASE = "https://phacdo.netlify.app/#/client";
  payload.link = `${NETLIFY_CLIENT_BASE}/${payload.customer_id}?t=${payload.token}`;

  // Tạo bản sao payload để ghi vào sheet Customers, loại bỏ tasks để tránh ghi nhầm vào cột không mong muốn
  const customerData = { ...payload };
  delete customerData.tasks;

  const rowData = headers.map(h => {
    let val = customerData[h];
    if (val === undefined || val === null) val = "";
    return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
  });

  let rowIndex = -1;
  const idIdx = headers.indexOf('customer_id');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === String(payload.customer_id)) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
  else sheet.appendRow(rowData);

  // Tối ưu: Chỉ cập nhật sheet Lịch trình nếu có tasks được gửi lên
  if (payload.hasOwnProperty('tasks') && payload.tasks !== undefined) {
    const pSheet = getSheetSmart_(ss, PLAN_SHEET_NAME);
    if (pSheet) {
      const pValues = pSheet.getDataRange().getValues();
      const pHeaders = pValues[0];
      
      // Nếu là thêm mới và không có tasks, có thể bỏ qua việc đọc/ghi sheet Lịch trình
      if (rowIndex <= 0 && (!Array.isArray(payload.tasks) || payload.tasks.length === 0)) {
        // Skip
      } else {
        const pNewRows = [pHeaders];
        // Lọc bỏ các dòng cũ của học viên này
        for (let i = 1; i < pValues.length; i++) {
          if (String(pValues[i][0]) !== String(payload.customer_id)) {
            pNewRows.push(pValues[i]);
          }
        }
        
        // Thêm các dòng mới
        if (Array.isArray(payload.tasks) && payload.tasks.length > 0) {
          payload.tasks.forEach(t => {
            if (!t.is_deleted) {
              const newRow = new Array(pHeaders.length).fill("");
              newRow[0] = String(payload.customer_id);
              newRow[1] = t.day || 0;
              newRow[2] = t.type || "";
              newRow[3] = t.title || "";
              newRow[4] = t.detail || "";
              newRow[5] = t.link || "";
              if (pHeaders.length > 6) newRow[6] = 0;
              pNewRows.push(newRow);
            }
          });
        }
        
        if (pNewRows.length > 0) {
           pSheet.clearContents().getRange(1, 1, pNewRows.length, pHeaders.length).setValues(pNewRows);
        }
      }
    }
  }
  
  return { success: true, customer_id: payload.customer_id, payload };
}

function renderStudentPage(u, t) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const customerRaw = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME).find(c => String(c.customer_id) === String(u));
    if (!customerRaw || String(customerRaw.token) !== String(t)) {
      return HtmlService.createHtmlOutput("<div style='font-family:sans-serif; text-align:center; padding-top:100px;'><h1>TRUY CẬP BỊ TỪ CHỐI</h1></div>");
    }
    
    const serverData = getServerData(u, t);
    const template = HtmlService.createTemplateFromFile('StudentPage');
    
    template.customer = {
      name: customerRaw.customer_name,
      app_title: customerRaw.app_title || "PHÁC ĐỒ 30 NGÀY THAY ĐỔI KHUÔN MẶT",
      app_slogan: customerRaw.app_slogan || "Hành trình đánh thức vẻ đẹp tự nhiên, gìn giữ thanh xuân.",
      start: customerRaw.start_date,
      end: customerRaw.end_date,
      note: String(customerRaw.note || ""),
      chewing: customerRaw.chewing_status || "",
      access_state: serverData.state,
      allowed_day: serverData.allowed_day,
      expire_warning: serverData.expire_warning,
      blocks: serverData.sidebar_blocks,
      tasks: serverData.tasks
    };
    template.params = { u: u, t: t };
    
    return template.evaluate()
      .setTitle("Phác đồ " + customerRaw.customer_name)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  } catch (e) { return HtmlService.createHtmlOutput("<h1>Lỗi: " + e.toString() + "</h1>"); }
}

function getServerData(u, t, force) {
  if (force === true) FORCE_REFRESH = true;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const c = dbReadSheet_Global(ss, CUSTOMER_SHEET_NAME).find(x => String(x.customer_id) === String(u));
  if (!c) return { ok: false };
  
  const acc = calculateAccessState(c);
  const state = acc.state;
  const allowed = acc.allowed_day;
  
  const today = new Date(); today.setHours(0,0,0,0);
  const end = toDate_Global(c.end_date);
  
  let blocks = [];
  try { if (c.sidebar_blocks_json) blocks = JSON.parse(c.sidebar_blocks_json); } catch (e) {}
  
  const isExpiringSoon = state === "ACTIVE" && end && ((end.getTime() - today.getTime()) / 86400000) <= 5;
  
  return { 
    ok: true, 
    tasks: getPlanData(ss, u, c.video_date, c), 
    state: state, 
    allowed_day: allowed, 
    expire_warning: isExpiringSoon,
    sidebar_blocks: blocks,
    start_date: c.start_date,
    end_date: c.end_date,
    app_title: c.app_title,
    app_slogan: c.app_slogan,
    note: c.note
  };
}
