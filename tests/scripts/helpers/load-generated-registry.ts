import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import ts from 'typescript'
import type { ZodType } from 'zod'

type GeneratedRegistry = {
  endpointEnhancements: Record<string, { responseSchema: ZodType }>
  errorSchemas: Record<string, Record<string, ZodType>>
  multipartEndpoints: Set<string>
}

// Load the actual freshly generated validators, not the project's committed
// output. Data URLs avoid writing JS files or requiring node_modules in OS temp.
function moduleUrl(source: string, imports: Record<string, string>): string {
  const resolvedSource = source.replace(
    /from (['"])([^'"]+)\1/g,
    (original, _quote: string, moduleName: string) => {
      const resolved = imports[moduleName]
      return resolved ? `from ${JSON.stringify(resolved)}` : original
    },
  )
  const { outputText } = ts.transpileModule(resolvedSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
    },
  })
  return (
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  )
}

export async function loadGeneratedRegistry(
  directory: string,
): Promise<GeneratedRegistry> {
  const zodUrl = import.meta.resolve('zod')
  const schemas = await readFile(join(directory, 'schemas.ts'), 'utf8')
  const schemasUrl = moduleUrl(schemas, { zod: zodUrl })
  const validation = await readFile(join(directory, 'validation.ts'), 'utf8')
  const validationUrl = moduleUrl(validation, {
    './schemas': schemasUrl,
    zod: zodUrl,
  })
  return (await import(/* @vite-ignore */ validationUrl)) as GeneratedRegistry
}
