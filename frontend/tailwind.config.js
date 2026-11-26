/** @type {import('tailwindcss').Config} */

// Semantic iOS-style colors. Each one is a CSS variable (see index.css) that
// switches between light and dark mode – components never need "dark:" variants.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                bg: v('bg'),            // grouped background
                card: v('card'),        // cells / cards
                card2: v('card2'),      // elevated / inset on cards
                fill: v('fill'),        // tinted control fill (segmented, search)
                label: v('label'),      // primary text
                label2: v('label2'),    // secondary text
                label3: v('label3'),    // tertiary / placeholder
                sep: v('sep'),          // hairlines
                accent: v('accent'),    // tint for text, icons, links
                tint: v('tint'),        // filled buttons
                navy: '#2B3E6A',
                sky: '#1AA7EC',
                ok: '#10B981',
                warn: '#F59E0B',
                danger: v('danger'),
            },
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
            },
            fontSize: {
                caption: ['12px', '16px'],
                footnote: ['13px', '18px'],
                sub: ['15px', '20px'],
                body: ['17px', '22px'],
                headline: ['17px', '22px'],
                title3: ['20px', '25px'],
                title2: ['22px', '28px'],
                title1: ['28px', '34px'],
                large: ['34px', '41px'],
            },
            borderRadius: {
                cell: '12px',
                card: '18px',
                sheet: '22px',
            },
            opacity: { 8: '0.08', 12: '0.12', 18: '0.18', 35: '0.35', 45: '0.45' },
            boxShadow: {
                pop: '0 10px 40px rgba(0,0,0,0.18)',
                soft: '0 1px 3px rgba(0,0,0,0.06)',
            },
        },
    },
    plugins: [],
};
