const path = require('path');

module.exports = {
  entry: [
    'regenerator-runtime/runtime.js',
    path.resolve(__dirname, 'src/core/index.js')
  ],
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: 'bipium-core.js',
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
  mode: 'development',
};
