import { downloadFileAsBuffer, findPdfBySku } from '@/lib/supabase/client';
import JSZip from 'jszip';

interface SkuItem {
  sku: string;
}

/**
 * Generate ZIP file containing sticker PDFs ONLY for products in the specific order
 * Uses SKU-only search across entire bucket (ignores folder structure)
 * Preserves the original order from the WooCommerce order by using sequential prefixes
 *
 * @param skuItems - Array of SKUs from the order's line_items
 * @param orderId - Order ID for naming the ZIP file
 * @returns ZIP buffer containing only the PDFs for ordered products in the correct order
 */
export async function generateZipFromSkus(skuItems: SkuItem[], orderId: number): Promise<Buffer> {
  const zip = new JSZip();
  let addedFiles = 0;

  console.log(
    `Generating ZIP for order ${orderId} with ${skuItems.length} SKUs (preserving order)`
  );

  // Process SKUs in the exact order they appear in the order
  for (let index = 0; index < skuItems.length; index++) {
    const { sku } = skuItems[index];

    if (!sku) {
      console.log(`Skipping item ${index + 1} - no SKU found`);
      continue;
    }

    try {
      console.log(`Processing item ${index + 1}/${skuItems.length} - SKU: ${sku}`);

      // Search for PDF by SKU across entire bucket (no folder structure needed)
      const foundPath = await findPdfBySku('stickers', sku);

      if (foundPath) {
        const pdfBuffer = await downloadFileAsBuffer('stickers', foundPath);

        if (pdfBuffer) {
          // Add sequential prefix to preserve order (001_, 002_, etc.)
          const orderPrefix = String(index + 1).padStart(3, '0');
          const fileName = `${orderPrefix}_${sku}.pdf`;

          zip.file(fileName, pdfBuffer);
          addedFiles++;

          console.log(`✅ Added ${fileName} (${pdfBuffer.length} bytes) from ${foundPath}`);
        } else {
          console.log(`❌ Failed to download PDF from path: ${foundPath}`);
        }
      } else {
        console.log(`❌ PDF not found for SKU: ${sku} (position ${index + 1})`);
      }
    } catch (error) {
      console.error(`Error processing SKU ${sku} at position ${index + 1}:`, error);
    }
  }

  if (addedFiles === 0) {
    console.warn(`No PDF files were added to ZIP for order ${orderId}`);
    zip.file(
      '000_README.txt',
      `Nema pronađenih PDF stickersa za narudžbu #${orderId}.\n\nTraženi SKU-ovi (po redoslijedu):\n${skuItems.map((item, idx) => `${idx + 1}. ${item.sku}`).join('\n')}\n\nMoguci razlozi:\n- PDF-ovi ne postoje u Supabase storage za ove SKU-ove\n- Nazivi SKU-ova se ne podudaraju točno s nazivima PDF datoteka\n- Datoteke nisu u očekivanom .pdf formatu\n\nNapomena: Ovaj ZIP sadrži samo PDF-ove za proizvode iz ove specifične narudžbe.\nSustav pretražuje cijeli bucket za svaki SKU i čuva redoslijed iz narudžbe.`
    );
  }

  console.log(
    `ZIP generation completed for order ${orderId}: ${addedFiles} files added (order preserved)`
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
