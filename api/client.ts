import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.MP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://yovjwbswfeblfswdxown.supabase.co";
const SUPABASE_KEY = process.env.MP_SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req: any, res: any) {
  if (process.env.MP_ENVIRONMENT === 'staging' && (!process.env.MP_SUPABASE_URL ||
      !process.env.MP_SUPABASE_SECRET_KEY || new URL(SUPABASE_URL).hostname === 'yovjwbswfeblfswdxown.supabase.co')) {
    return res.status(503).send('Staging database is not configured.');
  }
  const { id, t, debug } = req.query;
  
  let customerName = "";
  let debugInfo = "";

  if (id && SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // Try with ID ONLY first for OG tags (simplest, safest, avoids token query param issues)
      const { data, error } = await supabase
        .from('customers')
        .select('customer_name, customer_id, raw_backup')
        .eq('customer_id', id.trim())
        .maybeSingle();
      
      if (data && data.customer_name) {
        customerName = data.customer_name.trim();
        debugInfo = `Found: ${customerName}`;

        // Auto heal timezone mismatch if needed (ví dụ học viên Bảo Ánh Dương C1795142748594ZH2TD)
        if (data.raw_backup) {
          let raw = data.raw_backup;
          if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch (e) {}
          }
          if (raw && raw.completed_days_map) {
            const m = raw.completed_days_map;
            if (
              data.customer_id === 'C1795142748594ZH2TD' ||
              ((m[1] === '2026-11-21' || m['1'] === '2026-11-21') && (m[2] === '2026-11-21' || m['2'] === '2026-11-21'))
            ) {
              m[1] = '2026-11-19';
              m['1'] = '2026-11-19';
              m[2] = '2026-11-20';
              m['2'] = '2026-11-20';
              if (raw.date_to_lesson_day_map) {
                delete raw.date_to_lesson_day_map['2026-11-21'];
                raw.date_to_lesson_day_map['2026-11-19'] = 1;
                raw.date_to_lesson_day_map['2026-11-20'] = 2;
              }
              if (raw.last_video_open_date === '2026-11-21') {
                raw.last_video_open_date = '2026-11-20';
              }
              if (!raw.video_open_dates) raw.video_open_dates = [];
              if (!raw.video_open_dates.includes('2026-11-19')) raw.video_open_dates.push('2026-11-19');
              if (!raw.video_open_dates.includes('2026-11-20')) raw.video_open_dates.push('2026-11-20');
              raw.video_open_dates = raw.video_open_dates.filter((d: string) => d !== '2026-11-21');
              await supabase
                .from('customers')
                .update({ raw_backup: raw })
                .eq('customer_id', id.trim());
            }
          }
        }
      } else {
        debugInfo = `NotFound: ${id} | Error: ${error?.message || 'none'}`;
      }
    } catch (e: any) {
      debugInfo = `ExecError: ${e.message}`;
    }
  } else {
    debugInfo = `MissingConfig: id=${!!id}, url=${!!SUPABASE_URL}, key=${!!SUPABASE_KEY}`;
  }

  // Read index.html
  let indexPath = path.join(process.cwd(), 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    indexPath = path.join(process.cwd(), 'index.html');
  }

  try {
    let html = fs.readFileSync(indexPath, 'utf8');

    // Title structure: {Phác đồ trẻ hóa} + {Tên học viên}
    const title = customerName ? `Phác đồ trẻ hóa ${customerName}` : "Phác đồ trẻ hóa Mega Phương";
    const description = "Hành trình đánh thức vẻ đẹp tự nhiên, gìn giữ thanh xuân.";
    
    // Aggressive replacement for all possible meta tags
    html = html.replace(/<title[^>]*>.*?<\/title>/gi, `<title>${title}</title>`);
    
    const metaUpdates = [
      { p: 'og:title', c: title },
      { p: 'og:description', c: description },
      { n: 'twitter:title', c: title },
      { n: 'twitter:description', c: description },
      { n: 'description', c: description }
    ];

    metaUpdates.forEach(m => {
      const attr = m.p ? 'property' : 'name';
      const val = m.p || m.n;
      const regex = new RegExp(`<meta\\s+[^>]*?${attr}=["']?${val}["']?[^>]*?>`, 'gi');
      const tagContent = (val.includes('title')) ? title : description;
      const finalTag = `<meta ${attr}="${val}" content="${tagContent}" />`;
      
      if (regex.test(html)) {
        html = html.replace(regex, finalTag);
      } else {
        html = html.replace('</head>', `${finalTag}\n</head>`);
      }
    });

    // Inject debug info into a hidden comment only if explicitly requested
    if (debug === 'true') {
      html = html.replace('</body>', `<!-- OG Debug: ${debugInfo} | ${new Date().toISOString()} -->\n</body>`);
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).send(html);
  } catch (err: any) {
    res.status(500).send(`Server Error: ${err.message}`);
  }
}
