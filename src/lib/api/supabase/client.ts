import { createClient } from '@supabase/supabase-js';

// Lazy initialization to prevent build failures
let supabaseInstance: ReturnType<typeof createClient> | null = null;
let supabaseServiceInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseInstance;
}

// Service role client for server-side operations (Storage, etc.)
export function getSupabaseServiceClient() {
  if (!supabaseServiceInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase service role environment variables');
    }

    supabaseServiceInstance = createClient(supabaseUrl, supabaseServiceKey);
  }

  return supabaseServiceInstance;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof typeof client];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// Helper function to get public URL for storage objects
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = getSupabaseClient().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Helper function to download file as buffer
export async function downloadFileAsBuffer(bucket: string, path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await getSupabaseServiceClient().storage.from(bucket).download(path);

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
 * Search for PDF file by SKU across entire bucket
 * Ignores folder structure since each SKU is unique
 *
 * @param bucket - Storage bucket name (e.g., 'stickers')
 * @param sku - Product SKU to search for
 * @returns Full path to the file if found, null if not found
 */
export async function findPdfBySku(bucket: string, sku: string): Promise<string | null> {
  try {
    console.log(`Searching for SKU ${sku} across entire bucket ${bucket}`);

    // Search across entire bucket - much simpler!
    const found = await searchEntireBucket(bucket, sku);

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
 * Search entire bucket for a specific SKU file
 * Much faster than recursive folder traversal
 */
async function searchEntireBucket(bucket: string, sku: string): Promise<string | null> {
  try {
    // Use Supabase's search functionality to find the file
    const { data, error } = await getSupabaseServiceClient()
      .storage.from(bucket)
      .list('', {
        limit: 2000, // Increase limit to cover all files
        search: sku,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      console.error(`Error searching bucket ${bucket} for SKU ${sku}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`No files found for SKU ${sku} in bucket search`);

      // Fallback: try recursive search if direct search fails
      console.log(`Trying recursive search as fallback...`);
      return await findPdfBySkuRecursive(bucket, sku, '');
    }

    // Look for exact match first: filename should be {sku}.pdf
    const exactMatch = data.find(file => file.name === `${sku}.pdf`);

    if (exactMatch) {
      console.log(`Found exact match: ${exactMatch.name}`);
      return exactMatch.name;
    }

    // Look for file that ends with /{sku}.pdf (in any subfolder)
    const pathMatch = data.find(file => file.name.endsWith(`/${sku}.pdf`));

    if (pathMatch) {
      console.log(`Found path match: ${pathMatch.name}`);
      return pathMatch.name;
    }

    // Fallback: any file containing the SKU and ending with .pdf
    const partialMatch = data.find(file => file.name.includes(sku) && file.name.endsWith('.pdf'));

    if (partialMatch) {
      console.log(`Found partial match: ${partialMatch.name}`);
      return partialMatch.name;
    }

    return null;
  } catch (error) {
    console.error(`Error in bucket search for SKU ${sku}:`, error);
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

    const { data, error } = await getSupabaseServiceClient()
      .storage.from(bucket)
      .list(folder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
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
    const pdfFile = data.find(item => item.name === `${sku}.pdf`);

    if (pdfFile) {
      const fullPath = folder ? `${folder}/${pdfFile.name}` : pdfFile.name;
      console.log(`✅ Found PDF: ${fullPath}`);
      return fullPath;
    }

    // Get all subfolders (items without file extensions)
    const subFolders = data.filter(item => !item.name.includes('.') && item.name !== '.');

    console.log(
      `Found ${subFolders.length} subfolders in ${folder}:`,
      subFolders.map(f => f.name)
    );

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
