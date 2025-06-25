# WooCommerce Order Webhook Setup

## 🎯 Overview

Automatski workflow koji se pokreće kad stigne nova narudžba na WooCommerce:

1. Prima `order.created` webhook
2. Dohvaća brand informacije **samo za proizvode iz te narudžbe**
3. Preuzima sticker PDF-ove **samo za naručene proizvode** s Supabase Storage
4. Generira ZIP fajl `deklaracije-#ORDER_ID.zip` **samo s PDF-ovima iz narudžbe**
5. Šalje email na `info@welmora.ch` s ZIP prilogom

**Važno:** ZIP sadrži **samo deklaracije proizvoda iz konkretne narudžbe**, ne sve deklaracije!

## 🔧 Setup

### ✅ **Već konfigurirano:**

- Supabase URL i ključevi
- WooCommerce credentials
- Email adrese (info@welmora.ch)

### 🔑 **Što trebaš napraviti:**

#### 1. Gmail App Password (JEDINI KORAK!)

1. **Idi na:** [Google Account Settings](https://myaccount.google.com/)
2. **Security → 2-Step Verification** (mora biti uključeno)
3. **App passwords → Generate app password** za "Mail"
4. **Kopiraj generirani password** (format: `abcd efgh ijkl mnop`)
5. **Dodaj u `.env.local`:**
   ```env
   SMTP_PASS=abcd efgh ijkl mnop  # Tvoj pravi App Password
   ```

#### 2. WooCommerce Webhook Setup

**Korak po korak:**

1. **Ulogiraj se u WooCommerce Admin:** `https://welmora.ch/wp-admin`

2. **Navigiraj na webhooks:**

   ```
   WooCommerce → Settings → Advanced → Webhooks
   ```

3. **Klikni "Add webhook"**

4. **Popuni podatke:**

   ```
   Name: Order Created - Sticker Email
   Status: Active ✅
   Topic: Order created
   Delivery URL: https://welmora.ch/api/webhooks/order-created
   Secret: (ostavi prazno ili dodaj neki secret)
   API Version: WP REST API Integration v3
   ```

5. **Klikni "Save webhook"**

6. **Test webhook:** WooCommerce će poslati test payload

## 🚀 **Finalni Workflow:**

```mermaid
graph TD
    A[Nova WooCommerce narudžba] --> B[WooCommerce šalje webhook]
    B --> C[/api/webhooks/order-created prima podatke]
    C --> D[Dohvaća brand za svaki proizvod]
    D --> E[Preuzima PDF-ove s Supabase]
    E --> F[Generira ZIP: deklaracije-12345.zip]
    F --> G[Šalje email na info@welmora.ch]
    G --> H[✅ Gotovo!]
```

**Automatski se događa:**

1. Kupac napravi narudžbu na welmora.ch
2. WooCommerce šalje webhook na tvoj Next.js endpoint
3. Backend dohvaća brand informacije iz WooCommerce API-ja
4. Preuzima PDF-ove iz Supabase: `stickers/HR/{brand}/{sku}.pdf`
5. Kreira ZIP s PDF-ovima
6. Šalje email s prilozima na info@welmora.ch

## 🧪 Testing

### Test bez stvarne narudžbe:

```bash
curl -X POST https://welmora.ch/api/webhooks/test-order
```

### Provjeri webhook endpoint:

```bash
curl https://welmora.ch/api/webhooks/order-created
```

## 📁 Supabase Storage Struktura

Bucket `stickers` ima strukturu:

```
stickers/
  HR/
    Mueller/
      4058172628800.pdf
      4058172628817.pdf
    DM/
      4010355289346.pdf
    Rossmann/
      1234567890123.pdf
```

**Potvrđeno:** Folder se zove `stickers` (ne `sticker`)!

## 🔍 Ultra-Simple SKU Search Logic

**Samo SKU, ništa drugo!** Folderi postoje samo za tvoju organizaciju.

### **Super jednostavno pretraživanje:**

```javascript
// Traži SKU kroz cijeli bucket - ignorira folder strukturu
const foundPath = await findPdfBySku('stickers', sku);
// Rezultat: bilo koji path gdje se nalazi taj SKU
```

### **Bez brand logike:**

```
SKU: 4058172628800
→ Pronađe bilo gdje: HR/Mueller/4058172628800.pdf
→ Filename u ZIP-u: 4058172628800.pdf (samo SKU!)
```

**Maksimalno jednostavno - traži SKU kroz cijeli bucket! 🚀**

## 🚨 Error Handling

- **PDF ne postoji:** Preskoči fajl, nastavi s ostalima
- **Nema brand-a:** Preskoči proizvod
- **Email ne uspije:** Vrati 500 error s detaljima
- **Nema PDF-ova:** Šalje ZIP s README.txt objašnjenjem

## 📧 Email Template

**Subject:** `Nova narudžba #12345 - Deklaracije`

**Content:**

- Broj narudžbe
- Ime kupca
- Email kupca
- Ukupna vrijednost
- Broj stavki
- **ZIP prilog:** `deklaracije-12345.zip`

## 🐛 Debugging

### Development:

```bash
npm run dev
# Logovi u konzoli
```

### Production (Vercel):

- Provjeri **Function Logs** u Vercel dashboard
- Webhook pozive možeš vidjeti u WooCommerce → Settings → Advanced → Webhooks

### Ključni logovi:

```
=== WooCommerce Order Created Webhook ===
Step 1: Extracting brands from line items...
Step 2: Generating ZIP file...
Step 3: Sending email...
Email sent successfully: { messageId: '...', orderId: 12345 }
```

## 🔐 Security Notes

- Gmail App Password se koristi umjesto običnog passworda
- Webhook endpoint je javan ali validira podatke
- Supabase storage bucket `stickers` mora biti public readable
- Možeš dodati webhook signature validation za dodatnu sigurnost

## 🗂️ **Environment Files (DRY & Clean):**

```
.env.local      # Development secrets (dodaj SMTP_PASS)
.env.production # Production secrets (dodaj SMTP_PASS)
.env.example    # Template za developere
```

**Obrisano:** `.env.local.template` (redundantno)

---

## ⚡ **TL;DR - Što trebaš:**

1. **Dodaj Gmail App Password u `.env.local`** ← JEDINI KORAK
2. **Postavi webhook u WooCommerce Admin**
3. **Testiraj s** `/api/webhooks/test-order`

**I to je to! Workflow radi automatski! 🚀**
