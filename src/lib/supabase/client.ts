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
 * This bypasses the need to know the exact brand/folder structure
 * 
 * @param bucket - Storage bucket name
 * @param sku - Product SKU to search for
 * @returns Full path to the file if found, null if not found
 */
export async function findPdfBySku(bucket: string, sku: string): Promise<string | null> {
  try {
    console.log(`Searching for SKU ${sku} across all folders in bucket ${bucket}`);

    // Search for the SKU in the entire bucket
    const { data, error } = await supabase.storage
      .from(bucket)
      .list('', {
        limit: 1000, // Adjust if you have more files
        search: sku,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error(`Error searching for SKU ${sku}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`No files found for SKU ${sku}`);
      return null;
    }

    // Look for exact match: {sku}.pdf
    const exactMatch = data.find(file =>
      file.name === `${sku}.pdf` ||
      file.name.endsWith(`/${sku}.pdf`)
    );

    if (exactMatch) {
      console.log(`Found exact match: ${exactMatch.name}`);
      return exactMatch.name;
    }

    // If no exact match, try partial match
    const partialMatch = data.find(file =>
      file.name.includes(sku) && file.name.endsWith('.pdf')
    );

    if (partialMatch) {
      console.log(`Found partial match: ${partialMatch.name}`);
      return partialMatch.name;
    }

    console.log(`No PDF file found containing SKU ${sku}`);
    return null;

  } catch (error) {
    console.error(`Exception searching for SKU ${sku}:`, error);
    return null;
  }
}

/**
 * Recursively search through all subfolders for a file
 * This is a more thorough search if the simple search doesn't work
 */
export async function findPdfBySkuRecursive(
  bucket: string,
  sku: string,
  folder: string = ''
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error || !data) {
      return null;
    }

    // Check files in current folder
    const pdfFile = data.find(item =>
      !item.id && // It's a file, not a folder
      item.name === `${sku}.pdf`
    );

    if (pdfFile) {
      const fullPath = folder ? `${folder}/${pdfFile.name}` : pdfFile.name;
      console.log(`Found PDF recursively: ${fullPath}`);
      return fullPath;
    }

    // Recursively search subfolders
    const folders = data.filter(item => item.id === null && !item.name.includes('.'));

    for (const subFolder of folders) {
      const subPath = folder ? `${folder}/${subFolder.name}` : subFolder.name;
      const found = await findPdfBySkuRecursive(bucket, sku, subPath);
      if (found) {
        return found;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error in recursive search for ${sku}:`, error);
    return null;
  }
}
