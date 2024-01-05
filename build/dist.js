// create all required dist files
const fs = require('fs')
const execSync = require('child_process').execSync

let esbuildCmd = __dirname + '/../node_modules/.bin/esbuild'
if (fs.existsSync(esbuildCmd + '.cmd')) esbuildCmd += '.cmd'

const packageJson = require('../package.json')
const workerFile = __dirname + '/../src/browstorjs-filesystem-worker.js'
const tmpFile = __dirname + '/tmp.js'
const distFile = __dirname + '/../docs/scripts/browstorjs.js'
const minFile = __dirname + '/../docs/scripts/browstorjs.min.js'

execSync(esbuildCmd + ' ' + workerFile + ' --minify --outfile=' + tmpFile)

let contents = fs.readFileSync(distFile).toString()
contents = contents.replace('source:browstorjs-filesystem-worker.js', fs.readFileSync(tmpFile).toString().trim().replace("`", "\`"))
fs.unlinkSync(tmpFile)

contents = '// BrowstorJS v' + packageJson.version + ' @ ' + packageJson.homepage + '\n' + contents
contents = contents.replace(/export default class BrowstorJS/, 'class BrowstorJS')
fs.writeFileSync(distFile, contents)

execSync(esbuildCmd + ' ' + distFile + ' --minify --outfile=' + minFile)

fs.copyFileSync(distFile, __dirname + '/../dist/browstorjs.js')
fs.copyFileSync(minFile, __dirname + '/../dist/browstorjs.min.js')