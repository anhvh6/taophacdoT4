import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Hardcoded identifying info for the project to ensure connectivity
const SUPABASE_URL = "https://yovjwbswfeblfswdxown.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req: any, res: any) {
  const { id, t, debug } = req.query;
  
  let customerName = "";
  let debugInfo = "";

  if (id && SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // Try with ID ONLY first for OG tags (simplest, safest, avoids token query param issues)
      const { data, error } = await supabase
        .from('customers')
        .select('customer_name')
        .eq('customer_id', id.trim())
        .maybeSingle();
      
      if (data && data.customer_name) {
        customerName = data.customer_name.trim();
        debugInfo = `Found: ${customerName}`;
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

    // Inject debug info into a hidden comment for verification
    html = html.replace('</body>', `<!-- OG Debug: ${debugInfo} | ${new Date().toISOString()} -->\n</body>`);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).send(html);
  } catch (err: any) {
    res.status(500).send(`Server Error: ${err.message}`);
  }
}
