module.exports = {
    plugins: {
        '@tailwindcss/postcss': {
            config: './tailwind.config.cjs'
        },
        autoprefixer: require('autoprefixer'),
    }
}
