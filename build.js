const esbuild = require("esbuild");
const postCssPlugin = require("esbuild-plugin-postcss2");

const watch = process.argv.includes("--watch") && {
  onRebuild(error) {
    if (error) console.error("[watch] build failed", error);
    else console.log("[watch] build finished");
  },
};

esbuild
  .build({
    entryPoints: [
      "src/content.jsx",
      "src/popup.jsx",
      "src/background.js",
    ],
    outdir: "ext",
    bundle: true,
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    watch: watch,
    plugins: [
      postCssPlugin.default({
        plugins: [
          require("autoprefixer"), 
          require("tailwindcss"),
        ]
      }),
    ],
  })
  .catch((e) => console.error(e.message));