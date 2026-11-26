/** @type {import('tailwindcss').Config} */

// iOS-like neutral scale. The whole app uses Tailwind's "slate" classes, so
// redefining that scale gives every module the Apple grays at once
// (light: grouped gray background + white cards, dark: black + #1C1C1E cards).
const iosGray = {
    50: '#F2F2F7',
    100: '#E9E9EE',
    200: '#D9D9DE',
    300: '#C7C7CC',
    400: '#86868B',
    500: '#76767B',
    600: '#545458',
    700: '#38383A',
    800: '#1C1C1E',
    900: '#111113',
    950: '#000000',
};

export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                slate: iosGray,
                brand: {
                    dark: '#2B3E6A',
                    light: '#1AA7EC',
                },
            },
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
                outfit: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                lg: '0.75rem',
                xl: '1rem',
                '2xl': '1.25rem',
                '3xl': '1.5rem',
            },
            boxShadow: {
                sm: '0 1px 2px rgba(0,0,0,0.04)',
                md: '0 2px 8px rgba(0,0,0,0.06)',
                lg: '0 6px 18px rgba(0,0,0,0.08)',
                xl: '0 10px 30px rgba(0,0,0,0.10)',
                '2xl': '0 20px 50px rgba(0,0,0,0.18)',
            },
        },
    },
    plugins: [],
};
