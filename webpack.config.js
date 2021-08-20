const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    'bipium-core': [
      'regenerator-runtime/runtime.js',
      path.resolve(__dirname, 'src/core/index.js')
    ],
    'bipium-core.min': [
      'regenerator-runtime/runtime.js',
      path.resolve(__dirname, 'src/core/index.js')
    ],
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name].js',
    libraryTarget: 'var',
    library: 'Bipium',
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        },
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      include: /\.min\.js$/,
    })]
  },
  mode: 'production',
};
