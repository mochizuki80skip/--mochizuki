/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['../app/views/**/*.php', '../app/routes/**/*.php', '../public/assets/editor.js', '../public/install.php'],
  theme: {
    extend: {
      colors: { line: { DEFAULT: '#06C755', dark: '#04A047', light: '#E8F8EE' } },
    },
  },
};
