import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a function to determine the publicPath for GitHub Pages
const getPublicPath = () => {
    // In development, use the root path
    if (process.env.NODE_ENV !== 'production') {
        return '/';
    }

    try {
        // Get the repository name from homepage in package.json
        const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

        if (packageJson.homepage) {
            // Extract the repository name from the homepage URL
            const url = new URL(packageJson.homepage);
            const pathSegments = url.pathname.split('/').filter(Boolean);

            // The last segment should be the repository name
            if (pathSegments.length > 0) {
                return `/${pathSegments[pathSegments.length - 1]}/`;
            }
        }

        // Fallback to the package name if homepage is not properly set
        return `/${packageJson.name}/`;
    } catch (error) {
        console.warn('Error determining public path from package.json:', error);
        return '/';
    }
};

export default {
    entry: './src/web/index.tsx',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.[contenthash].js',
        publicPath: getPublicPath()
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        extensionAlias: {
            '.js': ['.js', '.ts', '.tsx'],
            '.jsx': ['.jsx', '.tsx']
        }
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: 'tsconfig.web.json',
                        compilerOptions: {
                            module: 'esnext',
                            moduleResolution: 'node'
                        }
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader'
                ]
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/web/index.html'
        }),
        new CopyPlugin({
            patterns: [
                // Copy the data directory to the build output
                {
                    from: 'data',
                    to: 'data',
                    noErrorOnMissing: true
                }
            ],
        }),
    ],
    devServer: {
        historyApiFallback: true,
        static: {
            directory: path.join(__dirname, 'dist')
        },
        hot: true,
        open: true,
        client: {
            overlay: true,
        }
    },
    // Added for better error reporting
    stats: {
        errorDetails: true,
    },
    // Development mode settings
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
}; 