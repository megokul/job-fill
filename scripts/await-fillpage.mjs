import fs from 'node:fs'

const path = 'src/content/filler.test.ts'
let text = fs.readFileSync(path, 'utf8')
text = text.replace(/it\('([^']+)', \(\) =>/g, "it('$1', async () =>")
text = text.replace(/(?<!await )fillPage\(/g, 'await fillPage(')
fs.writeFileSync(path, text)
console.log('updated', path)
