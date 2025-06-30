# PWA Camera Access Fix for iOS Safari

## Problem

PWA aplikacija (kada je dodana na home screen) nije mogla pristupiti kameri na iOS Safari uređajima, iako je u običnom Safari browseru sve radilo normalno.

## Root Cause

Nekoliko faktora je utjecalo na problem:

1. **Neispravne permissions u manifest.json** - PWA manifest ne podržava `"permissions"` polje
2. **Nedostaju iOS-specifični meta tagovi** za PWA camera access
3. **Nedostaju sigurnosni headers** za camera permissions
4. **Nedovoljna PWA detekcija** i iOS-specifično rukovanje kamerom

## Implementirane Popravke

### 1. Manifest.json Popravke

- Uklonjen neispravni `"permissions": ["camera", "geolocation"]` field
- Dodano `"prefer_related_applications": false` za bolju PWA podršku

### 2. Layout.tsx - Meta Tags i Headers

- Dodani iOS PWA meta tagovi:
  ```html
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-touch-fullscreen" content="yes" />
  <meta name="permissions-policy" content="camera=*, microphone=(), geolocation=()" />
  ```

### 3. Next.js Config - Security Headers

- Dodani Permissions-Policy headers za camera access:
  ```typescript
  {
    key: 'Permissions-Policy',
    value: 'camera=*, microphone=(), geolocation=(), payment=()',
  }
  ```

### 4. BarcodeScanner Komponenta - Poboljšanja

- **Bolja PWA detekcija**: Provjera za standalone mode, iOS standalone, i Android app referrer
- **iOS-specifične camera constraints**: Više permisivni constraints za iOS PWA
- **Poboljšano error handling**: Specifični error messages za različite tipove grešaka
- **Secure context provjera**: Osigurava da se kamera koristi samo preko HTTPS
- **Detaljnije logiranje**: Console logs za debugging camera pristupa

### 5. Camera Test Page

- Nova `/camera-test` stranica za debugging PWA camera pristupa
- Prikazuje environment info, device capabilities, i detaljne error messages
- Pomaže u dijagnosticiranju problema s kamerom u PWA modu

## Kako Testirati

### 1. Dodaj PWA na Home Screen

1. Otvori aplikaciju u Safari na iOS uređaju
2. Tap "Share" button (kvadrat s strelicom)
3. Scroll down i tap "Add to Home Screen"
4. Tap "Add"

### 2. Testiraj Camera Access

1. Otvori PWA aplikaciju s home screen-a
2. Idi na stranicu s barcode scanner-om
3. Tap "Pokreni skener"
4. Prihvati camera permissions kada se pojavi prompt

### 3. Debug s Camera Test Page

1. Idi na `/camera-test` u PWA aplikaciji
2. Provjeri environment info
3. Testiraj camera access
4. Provjeri console logs za detaljne informacije

## iOS Settings za PWA Camera

Ako kamera još uvijek ne radi u PWA modu:

1. **iOS Settings > Safari > Camera > Allow**
2. **iOS Settings > Privacy & Security > Camera** - provjeri je li Safari omogućen
3. Ukloni PWA s home screen-a i dodaj je ponovno
4. Restartaj iOS uređaj ako je potrebno

## Dodatne Napomene

- PWA aplikacije na iOS imaju ograničenja u odnosu na obične web aplikacije
- Camera access u PWA-u zahtijeva eksplicitno odobrenje korisnika
- Service Worker ne smije interferirati s camera stream-ovima
- HTTPS je obavezan za camera access u PWA modu

## Debugging Tips

1. Koristi Safari Web Inspector za debugging PWA aplikacije
2. Provjeri Console logs za camera errors
3. Testiraj u običnom Safari browser-u prvo
4. Koristi `/camera-test` stranicu za detaljnu dijagnozu
5. Provjeri Network tab za failed requests vezane uz camera

## Verification Steps

✅ Aplikacija se uspješno builda bez grešaka  
✅ PWA manifest je valjan  
✅ Meta tagovi su dodani u layout  
✅ Security headers su konfigurirani  
✅ BarcodeScanner ima poboljšano error handling  
✅ Camera test page je dostupna  
✅ Sve promjene su committed i pushed

## Next Steps

Testiraj PWA aplikaciju na iOS uređaju i provjeri radi li camera pristup. Ako još uvijek ima problema, koristi camera test page za debugging i provjeri iOS settings.
