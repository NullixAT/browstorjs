// create all required dist files
const fs = require('fs')

const packageJson = require('../package.json')
const srcFile = __dirname + '/../docs/scripts/browstorjs.js'
let contents = fs.readFileSync(srcFile).toString()
contents = '// BrowstorJS v' + packageJson.version + ' @ ' + packageJson.homepage + '\n' + contents
contents = contents.replace(/export default class BrowstorJS/, 'class BrowstorJS')
fs.writeFileSync(srcFile, contents)

fs.copyFileSync(__dirname + '/../docs/scripts/browstorjs.js', __dirname + '/../dist/browstorjs.js')