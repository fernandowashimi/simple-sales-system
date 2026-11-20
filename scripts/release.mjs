// Publica uma atualização: sobe a versão, faz commit + tag, envia e publica no GitHub Releases.
// Uso: npm run release [patch|minor|major]   (padrão: patch)
import { execSync } from 'node:child_process'

const bump = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`Tipo de versão inválido: ${bump} (use patch, minor ou major)`)
  process.exit(1)
}
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

if (out('git status --porcelain')) {
  console.error('Há mudanças sem commit. Faça o commit antes de publicar.')
  process.exit(1)
}

// build first, so a broken build never leaves a version commit/tag behind
run('npm run build')
run(`npm version ${bump} -m "release: v%s"`) // bumps package.json, commits and tags vX.Y.Z
run('git push --follow-tags')
const token = process.env.GH_TOKEN || out('gh auth token')
// out/ is already built; electron-builder reads the bumped version from package.json
run('npx electron-builder --win --publish always', {
  env: { ...process.env, GH_TOKEN: token }
})
