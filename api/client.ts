import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: any, res: any) {
  const { id, t } = req.query;
  
  let customerName = "";
  
  if (id && t && supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from('customers')
        .select('customer_name')
        .eq('customer_id', id)
        .eq('token', t)
        .maybeSingle();
      
      if (data && data.customer_name) {
        customerName = data.customer_name;
      }
    } catch (e) {
      console.error("Error fetching customer name for OG tags:", e);
    }
  }

  // Read index.html from the build output
  // In Vercel, the root of the deployment is process.cwd()
  // The build output is usually in 'dist'
  let indexPath = path.join(process.cwd(), 'dist', 'index.html');
  
  // Fallback for different environments
  if (!fs.existsSync(indexPath)) {
    indexPath = path.join(process.cwd(), 'index.html');
  }

  try {
    let html = fs.readFileSync(indexPath, 'utf8');

    const title = customerName ? `Phác đồ trẻ hóa ${customerName}` : "Phác đồ trẻ hóa Mega Phương";
    const description = "Hành trình đánh thức vẻ đẹp tự nhiên, gìn giữ thanh xuân.";
    
    // Replace title
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    
    // Replace OG Title
    if (html.includes('property="og:title"')) {
      html = html.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`);
    } else {
      html = html.replace('</head>', `<meta property="og:title" content="${title}" />\n</head>`);
    }

    // Replace OG Description
    if (html.includes('property="og:description"')) {
      html = html.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${description}" />`);
    } else {
      html = html.replace('</head>', `<meta property="og:description" content="${description}" />\n</head>`);
    }
    
    // Replace Twitter Title
    if (html.includes('name="twitter:title"')) {
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/g, `<meta name="twitter:title" content="${title}" />`);
    }

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (err) {
    console.error("Error reading index.html:", err);
    res.status(500).send("Internal Server Error");
  }
}
