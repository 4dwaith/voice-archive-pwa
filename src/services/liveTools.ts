import {
  Behavior,
  type FunctionCall,
  type FunctionDeclaration,
  type FunctionResponse,
} from '@google/genai'
import { z } from 'zod'
import { type createLiveQueries } from './liveQueries'

const noArguments = z.strictObject({})
const schemas = {
  getAppHelp: z.strictObject({
    topic: z.enum(['overview', 'reader', 'live', 'turner']),
  }),
  getAppLocation: noArguments,
  getReaderSettings: noArguments,
  getReadingPosition: noArguments,
  getBookDownloadState: z.strictObject({
    bookId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }),
  getNarrationState: noArguments,
  endLiveSession: noArguments,
}
const descriptions = [
  'Get manual help for overview, reader, live or turner.',
  'Get current route and reader availability.',
  'Get current text size and Text/PDF setting.',
  'Get canonical anchor and separate selections.',
  'Get text download progress and committed completeness for a book.',
  'Get requested and reported narration state, cue and error.',
  'End Live immediately, preserving continuation. No farewell required.',
]
export const liveToolDeclarations: FunctionDeclaration[] = Object.entries(
  schemas,
).map(([name, schema], index) => ({
  name,
  description: descriptions[index],
  behavior: Behavior.BLOCKING,
  parametersJsonSchema: z.toJSONSchema(schema),
}))

export type LiveEffectReceipts = Record<string, string>
type ToolResponse = Record<string, unknown>
type ToolResult = ToolResponse | Promise<ToolResponse>

export function createLiveTools(
  queries: ReturnType<typeof createLiveQueries>,
  endLiveSession: () => unknown,
) {
  const calls = new Map<string, { signature: string; result: ToolResult }>()
  return {
    clear() {
      calls.clear()
    },
    connect(
      signal: AbortSignal,
      receipts: LiveEffectReceipts,
      saveReceipts: () => void,
      send: (response: FunctionResponse) => void,
    ) {
      const cancelled = new Set<string>()
      return {
        cancel(ids: string[]) {
          ids.forEach((id) => cancelled.add(id))
        },
        async invoke(call: FunctionCall) {
          const { id, name } = call
          if (
            typeof id !== 'string' ||
            !id ||
            typeof name !== 'string' ||
            !name
          )
            return
          if (signal.aborted || cancelled.has(id)) return
          let response: Record<string, unknown>
          const schema = Object.hasOwn(schemas, name)
            ? schemas[name as keyof typeof schemas]
            : null
          const parsed = schema?.safeParse(
            call.args === undefined ? {} : call.args,
          )
          if (!parsed?.success)
            response = { error: 'Unknown tool or invalid arguments' }
          else {
            const signature = JSON.stringify([name, parsed.data])
            const prior = calls.get(id)
            const receipt = Object.hasOwn(receipts, id)
              ? receipts[id]
              : undefined
            if (
              (prior && prior.signature !== signature) ||
              (receipt && receipt !== signature)
            )
              response = { error: 'Conflicting tool call ID' }
            else if (receipt) response = { accepted: true, requestId: id }
            else if (prior)
              response =
                prior.result instanceof Promise
                  ? await prior.result
                  : prior.result
            else {
              if (name === 'endLiveSession') {
                const accepted = { accepted: true, requestId: id }
                Object.defineProperty(receipts, id, {
                  value: signature,
                  enumerable: true,
                })
                saveReceipts()
                endLiveSession()
                response = accepted
              } else {
                const failure = {
                  error:
                    'Information unavailable; use the manual controls or retry.',
                }
                let result: ToolResult
                try {
                  const query = queries[name as keyof typeof queries] as (
                    args: unknown,
                  ) => unknown
                  const value = query(parsed.data)
                  result =
                    value instanceof Promise
                      ? value.then(
                          (result) => ({ result }),
                          () => failure,
                        )
                      : { result: value }
                } catch {
                  result = failure
                }
                calls.set(id, { signature, result })
                response = result instanceof Promise ? await result : result
              }
            }
          }
          if (!signal.aborted && !cancelled.has(id))
            send({ id, name, response })
        },
      }
    },
  }
}
