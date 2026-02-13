import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';

import path from 'path';

export default {
  input: 'src/detailed-charts-panel.js',
  output: {
    file: 'dist/detailed-charts-panel.js',
    format: 'es',
    inlineDynamicImports: true
  },
  plugins: [
    alias({
      entries: [
        { find: 'chart.js/helpers', replacement: path.resolve(process.cwd(), 'src/chart-helpers-adapter.js') },
        { find: 'chart.js', replacement: path.resolve(process.cwd(), 'src/chart.umd.min.js') },
        { find: 'hammerjs', replacement: path.resolve(process.cwd(), 'src/hammer.min.js') },
        { find: 'chartjs-plugin-zoom', replacement: path.resolve(process.cwd(), 'src/chartjs-plugin-zoom.min.js') }
      ]
    }),
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs({
      include: [/node_modules/, /src\/.*\.(js|mjs)$/]
    })
  ]
};
