# Nexora — AI Prescription Scanner & Generic Medicine Finder

A mobile-first, deep-blue dark-mode web app that scans prescriptions with Google Gemini Vision and compares branded medicines against low-cost generic alternatives available in Pakistan — showing exact prices and percentage savings.

## Live Demo & App Screenshots

**Live App URL:** [https://nox-ai-mu.vercel.app](https://nox-ai-mu.vercel.app)

| Scan Interface | AI Analysis Result | Savings Dashboard |
| :---: | :---: | :---: |
| ![Scan](./screenshots/scan.png) | ![Result](./screenshots/result.png) | ![Analytics](./screenshots/analytics.png) |

## What It Does

1. **Scan a prescription** — upload a photo or PDF via the central dropzone.
2. **AI extraction** — Google Gemini Vision reads the prescription and returns structured data: the diagnosed condition plus every medicine with brand, formula, original price, cheapest generic alternative, generic price, and savings percentage.
3. **See your savings** — an analytics dashboard shows total savings, medicine analysis, an animated price-impact bar chart, and a detailed list of generic alternatives with green "% Savings" badges.

## Design

- **Deep blue aesthetic** — `#0B1229` background with card-based modular layout, teal and blue accent glows.
- **Top header** — integrated deep-blue bar with a hamburger icon, the Nexora geometric logo and name on the left, and a notification bell + user profile circle on the right.
- **Hero card** — "AI-POWERED GENERIC FINDER" (teal on blue), the main heading, sub-heading, and three metric cards: 100% Safe, 2s Scan Time, 65% Avg. Savings.
- **Prescription Scanner** — large central dropzone with an upload icon and a blue "Photo or scan supported" button inside, plus a prominent "SCAN PRESCRIPTION" button below.
- **Analytics Dashboard** — SAVINGS SUMMARY, MEDICINE ANALYSIS, and PRICE IMPACT cards with visual charts that populate after scanning.
- **Top Alternative Choices** — a large card listing each medicine as original brand → formula → generic alternative, with a highlighted savings badge.
- **Bottom navigation bar** — fixed deep-blue bar with Home, Scan, Analytics, History, and Account.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| AI Vision | Google Gemini 1.5 Flash API |
| Deployment | Vercel-ready static build |

## Getting Started

```bash
npm install
npm run dev
```

### Environment Variables (Optional)

The app works without any configuration thanks to a built-in fallback dataset (Panadol → Calpol, 65% savings). To enable real Gemini Vision scanning:

```bash
echo "VITE_GEMINI_API_KEY=your_gemini_api_key_here" > .env.local
```

Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/
│   ├── TopHeader.tsx            # Deep-blue header: hamburger + Nexora logo + bell + user
│   ├── BottomNav.tsx            # Fixed bottom nav: Home/Scan/Analytics/History/Account
│   ├── HeroSection.tsx          # AI-POWERED GENERIC FINDER card + 3 metric cards
│   ├── PrescriptionScanner.tsx  # Dropzone + scan animation + SCAN PRESCRIPTION button
│   ├── AnalyticsDashboard.tsx   # Savings Summary + Medicine Analysis + Price Impact chart
│   └── AlternativePanel.tsx     # Top Alternative Choices with savings badges
├── lib/
│   └── gemini.ts                # Gemini Vision API call + fallback mock data
├── types.ts                     # TypeScript interfaces
├── App.tsx                      # Mobile-first layout
├── main.tsx                     # React entry point
└── index.css                    # Tailwind + Nexora theme utilities
```

## Gemini API Response Schema

The scan logic sends the prescription image to Gemini with a strict prompt enforcing this JSON:

```json
{
  "disease_or_condition": "Fever & Mild Pain (Paracetamol Course)",
  "medicines": [
    {
      "original_brand": "Panadol 500mg",
      "formula": "Paracetamol 500mg",
      "original_price_pkr": 45,
      "cheap_alternative": "Calpol (GSK Generic)",
      "alternative_price_pkr": 16,
      "savings_percentage": 65
    }
  ]
}
```

## Disclaimer

Nexora is for **informational and demonstration purposes only**. It does not provide medical advice. Always consult a licensed healthcare professional before switching medications. Prices are estimates and may not reflect current market prices.
