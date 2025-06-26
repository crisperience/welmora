# Metro.de Anti-Bot Protection Analysis

## Trenutno stanje Metro scrapera

### Identificirane anti-bot zaštite:

1. **Module Federation Architecture**
   - Metro koristi naprednu Module Federation (Webpack 5) arhitekturu
   - JavaScript se učitava dinamički kroz module federation
   - Glavni sadržaj se renderira tek nakon što se svi moduli učitaju

2. **Multi-layered JavaScript Loading**
   - Početni HTML je minimal s spinner animacijom
   - Pravi sadržaj se učitava kroz:
     - `/ordercapture/uidispatcher/static/app/scripts.js`
     - `/ordercapture/uidispatcher/static/injector.js`
     - Više od 10 različitih micro-frontend modula

3. **Behavioral Detection**
   - Detektira headless browsere kroz:
     - JavaScript execution patterns
     - Mouse movement tracking
     - Keyboard interaction detection
     - Viewport and screen resolution analysis

4. **Session Management**
   - Kompleksan cookie sustav
   - Multi-step authentication flow
   - IDAM (Identity and Access Management) integration

## Trenutni problemi s scraperima:

### Metro Scraper (standardni)

- **Problem**: Detektiran kao bot kroz Puppeteer fingerprinting
- **Simptomi**: Stranica se učitava, ali proizvodi se ne prikazuju
- **Status**: ❌ Ne radi

### Metro Guest Scraper

- **Problem**: Isti problemi kao standardni scraper
- **Simptomi**: Prazna stranica bez sadržaja
- **Status**: ❌ Ne radi

### Metro BrightData Scraper

- **Konfiguracija**:
  - Customer ID: `hl_24448dfb`
  - Zone: `welmora`
  - Password: `u76vogflsoq3`
- **Status**: 🟡 Treba testirati

## Detaljne prepreke:

### 1. JavaScript Dependency Chain

```
Initial HTML → scripts.js → injector.js → Module Federation → Content Rendering
```

### 2. Anti-Bot Indicators Found:

- **User-Agent detection**: Standardni Puppeteer UA se blokira
- **WebDriver detection**: `navigator.webdriver` property
- **Headless detection**: Missing window properties
- **TLS Fingerprinting**: HTTP/2 fingerprint analysis
- **Behavioral analysis**: Nedostatak prirodnih mouse/keyboard eventova

### 3. Module Federation Complexity:

- Sadržaj se učitava kroz 9+ različitih micro-frontend modula
- Svaki modul ima vlastiti lifecycle
- Potrebno je čekati da se svi moduli inicijaliziraju

## Preporučene strategije za zaobilaženje:

### 1. BrightData pristup (najvjerojatniji uspjeh)

```javascript
// Koristiti postojeći BrightData scraper
// Testirati s različitim proxy pool opcijama
// Dodati dodatno čekanje za module federation
```

### 2. Stealth browser optimizacije

```javascript
// Koristiti undetected-chromedriver
// Implementirati mouse movement simulation
// Dodati realistic typing delays
// Koristiti residential proxy rotation
```

### 3. Browser Extension pristup

```javascript
// Kreirati Chrome extension koji radi kao proxy
// Extension ima pristup stvarnim browser cookies
// Zaobići sve anti-bot detections
```

### 4. API Reverse Engineering

```javascript
// Analizirati network requests nakon login
// Identificirati direct API endpoints
// Zaobići frontend potpuno
```

## Sljedeći koraci:

1. **Testirati BrightData scraper** - najveća šansa za uspjeh
2. **Implementirati browser extension pristup** ako BrightData ne radi
3. **Reverse engineer API endpoints** kao backup opcija
4. **Optimizirati postojeće scrapere** s boljim stealth tehnikama

## Test GTIN za validaciju:

- `7702018070794` (trenutno se koristi)
- Alternativni: `4005900123456`

## Zaključak:

Metro.de ima vrlo sofisticiranu anti-bot zaštitu koja kombinira:

- Module Federation architecture
- Behavioral analysis
- TLS/HTTP fingerprinting
- Multi-layered JavaScript loading

BrightData pristup ima najveće šanse za uspjeh jer koristi stvarne browser fingerprinte i residential proxy mrežu.
