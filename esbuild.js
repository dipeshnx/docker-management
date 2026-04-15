const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Stub out optional native modules that dockerode doesn't need for socket connections
const nativeStubPlugin = {
  name: 'native-stub',
  setup(build) {
    build.onResolve({ filter: /^(ssh2|cpu-features)$/ }, () => ({
      path: 'stub',
      namespace: 'native-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'native-stub' }, () => ({
      contents: 'module.exports = {};',
    }));
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    plugins: [nativeStubPlugin],
    logLevel: 'info',
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
