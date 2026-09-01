/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 状态色同样收敛：降饱和、降亮度，避免荧光感
        cyan: {
          50: '#eef4fd', 100: '#d9e7fb', 200: '#b7d2f7', 300: '#8ab5f0',
          400: '#5e95e4', 500: '#3d7ad2', 600: '#2f62b4', 700: '#284f90',
          800: '#244274', 900: '#22395f', 950: '#17243d',
        },
        sky: {
          50: '#eef4fd', 100: '#d9e7fb', 200: '#b7d2f7', 300: '#8ab5f0',
          400: '#5e95e4', 500: '#3d7ad2', 600: '#2f62b4', 700: '#284f90',
          800: '#244274', 900: '#22395f', 950: '#17243d',
        },
        blue: {
          50: '#eef4fd', 100: '#d9e7fb', 200: '#b7d2f7', 300: '#8ab5f0',
          400: '#5e95e4', 500: '#3d7ad2', 600: '#2f62b4', 700: '#284f90',
          800: '#244274', 900: '#22395f', 950: '#17243d',
        },
        green: {
          50: '#eff6f0', 100: '#d8ebdb', 200: '#b2d6b9', 300: '#84bb8f',
          400: '#5b9d69', 500: '#42804f', 600: '#33673e', 700: '#2b5334',
          800: '#26442c', 900: '#213a27', 950: '#0f2013',
        },
        emerald: {
          50: '#eff6f0', 100: '#d8ebdb', 200: '#b2d6b9', 300: '#84bb8f',
          400: '#5b9d69', 500: '#42804f', 600: '#33673e', 700: '#2b5334',
          800: '#26442c', 900: '#213a27', 950: '#0f2013',
        },
        teal: {
          50: '#eff6f0', 100: '#d8ebdb', 200: '#b2d6b9', 300: '#84bb8f',
          400: '#5b9d69', 500: '#42804f', 600: '#33673e', 700: '#2b5334',
          800: '#26442c', 900: '#213a27', 950: '#0f2013',
        },
        red: {
          50: '#fdf0ef', 100: '#fbdcd9', 200: '#f5bab4', 300: '#ec9088',
          400: '#dd6a5f', 500: '#c94f43', 600: '#a83e34', 700: '#87332c',
          800: '#702e28', 900: '#5f2a25', 950: '#33130f',
        },

        // ── Cursor 风格调色板覆盖 ──
        // 组件中已大量使用 slate/indigo/purple/amber，这里重定义其色值，
        // 无需逐个改组件即可全站生效。灰阶去蓝调，强调色收敛为单一蓝。
        slate: {
          50: '#f7f7f8', 100: '#ececee', 200: '#d8d8db', 300: '#b6b6bb',
          400: '#8a8a91', 500: '#6b6b72', 600: '#525258', 700: '#3a3a3f',
          800: '#26262a', 900: '#1b1b1e', 950: '#141416',
        },
        gray: {
          50: '#f7f7f8', 100: '#ececee', 200: '#d8d8db', 300: '#b6b6bb',
          400: '#8a8a91', 500: '#6b6b72', 600: '#525258', 700: '#3a3a3f',
          800: '#26262a', 900: '#1b1b1e', 950: '#141416',
        },
        indigo: {
          50: '#eef4fd', 100: '#d9e7fb', 200: '#b7d2f7', 300: '#8ab5f0',
          400: '#5e95e4', 500: '#3d7ad2', 600: '#2f62b4', 700: '#284f90',
          800: '#244274', 900: '#22395f', 950: '#17243d',
        },
        purple: {
          50: '#eef4fd', 100: '#d9e7fb', 200: '#b7d2f7', 300: '#8ab5f0',
          400: '#5e95e4', 500: '#3d7ad2', 600: '#2f62b4', 700: '#284f90',
          800: '#244274', 900: '#22395f', 950: '#17243d',
        },
        violet: {
          50: '#eef4fd', 100: '#d9e7fb', 200: '#b7d2f7', 300: '#8ab5f0',
          400: '#5e95e4', 500: '#3d7ad2', 600: '#2f62b4', 700: '#284f90',
          800: '#244274', 900: '#22395f', 950: '#17243d',
        },
        amber: {
          50: '#fdf7ed', 100: '#f8ebd0', 200: '#f0d5a0', 300: '#e5ba6b',
          400: '#d9a047', 500: '#c9882f', 600: '#a86c26', 700: '#855322',
          800: '#6d4422', 900: '#5c3a20', 950: '#341e0f',
        },
        orange: {
          50: '#fdf7ed', 100: '#f8ebd0', 200: '#f0d5a0', 300: '#e5ba6b',
          400: '#d9a047', 500: '#c9882f', 600: '#a86c26', 700: '#855322',
          800: '#6d4422', 900: '#5c3a20', 950: '#341e0f',
        },
        yellow: {
          50: '#fdf7ed', 100: '#f8ebd0', 200: '#f0d5a0', 300: '#e5ba6b',
          400: '#d9a047', 500: '#c9882f', 600: '#a86c26', 700: '#855322',
          800: '#6d4422', 900: '#5c3a20', 950: '#341e0f',
        },
        rose: {
          50: '#fdf0ef', 100: '#fbdcd9', 200: '#f5bab4', 300: '#ec9088',
          400: '#dd6a5f', 500: '#c94f43', 600: '#a83e34', 700: '#87332c',
          800: '#702e28', 900: '#5f2a25', 950: '#33130f',
        },
        pink: {
          50: '#fdf0ef', 100: '#fbdcd9', 200: '#f5bab4', 300: '#ec9088',
          400: '#dd6a5f', 500: '#c94f43', 600: '#a83e34', 700: '#87332c',
          800: '#702e28', 900: '#5f2a25', 950: '#33130f',
        },

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        neon: {
          indigo: '#6366F1',
          purple: '#8B5CF6',
          cyan: '#06B6D4',
          green: '#22C55E',
          red: '#EF4444',
          amber: '#F59E0B',
          blue: '#3B82F6'
        },
        dark: {
          '700': '#334155',
          '800': '#1E293B',
          '900': '#0F172A'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'Segoe UI',
          'Microsoft YaHei UI',
          'PingFang SC',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'Cascadia Mono',
          'Consolas',
          'Microsoft YaHei UI',
          'monospace'
        ]
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      keyframes: {
        glow: {
          '0%': {
            boxShadow: '0 0 5px rgba(99, 102, 241, 0.2)'
          },
          '100%': {
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.6)'
          }
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0)'
          },
          '50%': {
            transform: 'translateY(-5px)'
          }
        },
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
