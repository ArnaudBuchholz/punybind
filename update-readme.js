const { stat, readFile, writeFile } = require('fs/promises')

async function main () {
  const readme = (await readFile('./README.md')).toString()
  const dist = await stat('./dist/punybind.js')
  const modified = readme.replace(/\*\(\d+ bytes\)\*/, () => `*(${dist.size} bytes)*`)
  await writeFile('./README.md', modified)
}

main()
