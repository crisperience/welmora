import { downloadFileAsBuffer, findPdfBySku } from '@/lib/supabase/client';
import JSZip from 'jszip';

interface SkuItem {
  sku: string;
}

/**
 * Generate ZIP file containing sticker PDFs ONLY for products in the specific order
 * Uses SKU-only search across entire bucket (ignores folder structure)
 *
 * @param skuItems - Array of SKUs from the order's line_items
 * @param orderId - Order ID for naming the ZIP file
 * @returns ZIP buffer containing only the PDFs for ordered products
 */
export async function generateZipFromSkus(skuItems: SkuItem[], orderId: number): Promise<Buffer> {
  const zip = new JSZip();
  let addedFiles = 0;

  console.log(
    `Generating ZIP for order ${orderId} with ${skuItems.length} SKUs (searching entire bucket)`
  );

  for (const { sku } of skuItems) {
    if (!sku) {
      console.log(`Skipping item - no SKU found`);
      continue;
    }

    try {
      console.log(`Searching for PDF for SKU: ${sku}`);

      // Search for PDF by SKU across entire bucket (no folder structure needed)
      const foundPath = await findPdfBySku('stickers', sku);

      if (foundPath) {
        const pdfBuffer = await downloadFileAsBuffer('stickers', foundPath);

        if (pdfBuffer) {
          // Simple filename: just SKU.pdf (no brand needed)
          const fileName = `${sku}.pdf`;

          zip.file(fileName, pdfBuffer);
          addedFiles++;

          console.log(
            `✅ Found and added: ${fileName} (${pdfBuffer.length} bytes) from ${foundPath}`
          );
        } else {
          console.log(`❌ Failed to download PDF from path: ${foundPath}`);
        }
      } else {
        console.log(`❌ PDF not found for SKU: ${sku}`);
      }
    } catch (error) {
      console.error(`Error processing SKU ${sku}:`, error);
    }
  }

  if (addedFiles === 0) {
    console.warn(`No PDF files were added to ZIP for order ${orderId}`);
    zip.file(
      'README.txt',
      `No sticker PDFs were found for order #${orderId}.\n\nSearched for the following SKUs:\n${skuItems.map(item => `- ${item.sku}`).join('\n')}\n\nThis may be because:\n- PDFs don't exist in Supabase storage for these SKUs\n- SKU names don't match exactly with PDF filenames\n- Files are not in the expected .pdf format\n\nNote: This ZIP only contains PDFs for products in this specific order.\nThe system searches across the entire bucket for each SKU.`
    );
  }

  console.log(
    `ZIP generation completed for order ${orderId}: ${addedFiles} files added (bucket-wide SKU search)`
  );

  // Generate ZIP buffer
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  });

  return zipBuffer;
}
