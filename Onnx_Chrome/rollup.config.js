// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default {
  // Multiple entry points:
  input: {
    background: 'src/background.js',
    popup: 'src/popup.js'
    // If image_processor.js is only imported by these two,
    // no need to add it as an entry
  },
  output: {
    dir: 'dist',
    format: 'esm',
    // Use [name].js so Rollup names them background.js and popup.js
    entryFileNames: '[name].js'
  },
  plugins: [
    resolve(),
    commonjs(),
    copy({
      targets: [
        // Copy manifest.json into dist/
        { src: 'manifest.json', dest: 'dist/' },
        // Copy everything in public/ to dist/public/
        { src: 'public/*', dest: 'dist/public/' },
        // Copy popup.html to dist/ (if you keep it in src/)
        { src: 'src/popup.html', dest: 'dist/' },
        // Optional: if you have a wasm/ folder, copy to dist/wasm
        { src: 'wasm/*', dest: 'dist/wasm/' }
      ]
    })
  ]
};
