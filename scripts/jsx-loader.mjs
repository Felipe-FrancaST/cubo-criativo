import { readFile } from 'node:fs/promises'
import { transformSync } from '@babel/core'
import transformJsx from '@babel/plugin-transform-react-jsx'

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.'))
      throw error
    for (const extension of ['.js', '.jsx']) {
      try {
        return await nextResolve(`${specifier}${extension}`, context)
      } catch {}
    }
    throw error
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css'))
    return {
      format: 'module',
      source: 'export default {};',
      shortCircuit: true,
    }
  if (
    !url.startsWith('file:') ||
    url.includes('/node_modules/') ||
    !/\.(jsx|js)$/.test(url)
  )
    return nextLoad(url, context)
  let source = await readFile(new URL(url), 'utf8')
  source = source.replaceAll('import.meta.env', 'process.env')
  if (url.endsWith('.jsx'))
    source = transformSync(source, {
      filename: new URL(url).pathname,
      configFile: false,
      babelrc: false,
      plugins: [[transformJsx, { runtime: 'automatic' }]],
    }).code
  return { format: 'module', source, shortCircuit: true }
}
