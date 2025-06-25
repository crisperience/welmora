import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to get public URL for storage objects
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Helper function to download file as buffer
export async function downloadFileAsBuffer(bucket: string, path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error) {
      console.error(`Error downloading file ${path}:`, error);
      return null;
    }

    if (!data) {
      console.error(`No data returned for file ${path}`);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Exception downloading file ${path}:`, error);
    return null;
  }
}

/**
 * Search for PDF file by SKU across all folders in bucket
 * Searches through nested structure: HR/Brand/SKU.pdf
 * 
 * @param bucket - Storage bucket name (e.g., 'stickers')
 * @param sku - Product SKU to search for
 * @returns Full path to the file if found, null if not found
 */
export async function findPdfBySku(bucket: string, sku: string): Promise<string | null> {
  try {
    console.log(`Searching for SKU ${sku} in bucket ${bucket} with structure HR/Brand/SKU.pdf`);

    // Start recursive search from HR folder
    const found = await findPdfBySkuRecursive(bucket, sku, 'HR');

    if (found) {
      console.log(`✅ Found PDF for SKU ${sku}: ${found}`);
      return found;
    }

    console.log(`❌ No PDF file found for SKU ${sku}`);
    return null;

  } catch (error) {
    console.error(`Exception searching for SKU ${sku}:`, error);
    return null;
  }
}

/**
 * Recursively search through all subfolders for a file
 * Searches through structure: HR/Brand/SKU.pdf
 */
export async function findPdfBySkuRecursive(
  bucket: string,
  sku: string,
  folder: string = ''
): Promise<string | null> {
  try {
    console.log(`Searching in folder: ${folder}`);

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error(`Error listing folder ${folder}:`, error);
      return null;
    }

    if (!data) {
      console.log(`No data returned for folder ${folder}`);
      return null;
    }

    console.log(`Found ${data.length} items in folder ${folder}`);

    // Check files in current folder - look for exact SKU.pdf match
    const pdfFile = data.find(item =>
      item.name === `${sku}.pdf`
    );

    if (pdfFile) {
      const fullPath = folder ? `${folder}/${pdfFile.name}` : pdfFile.name;
      console.log(`✅ Found PDF: ${fullPath}`);
      return fullPath;
    }

    // Get all subfolders (items without file extensions)
    const subFolders = data.filter(item =>
      !item.name.includes('.') && item.name !== '.'
    );

    console.log(`Found ${subFolders.length} subfolders in ${folder}:`, subFolders.map(f => f.name));

    // Recursively search each subfolder
    for (const subFolder of subFolders) {
      const subPath = folder ? `${folder}/${subFolder.name}` : subFolder.name;
      const found = await findPdfBySkuRecursive(bucket, sku, subPath);
      if (found) {
        return found;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error in recursive search for ${sku} in folder ${folder}:`, error);
    return null;
  }
}
